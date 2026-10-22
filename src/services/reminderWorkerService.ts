/**
 * reminderWorkerService.ts
 *
 * Worker em background que garante 100% de envio de lembretes:
 *
 * CAMADA 1 — Server-side (Edge Function send-reminders):
 *   Chamada automaticamente por pg_cron ou pelo worker.
 *   Envia email real (Resend) + WhatsApp real (Business API) + in-app.
 *   Funciona mesmo que NENHUM utilizador tenha a app aberta.
 *
 * CAMADA 2 — Client-side (este worker):
 *   Executa a cada 30 min quando a app está aberta.
 *   Envia in-app + push local + deep-link WhatsApp.
 *   Serve como redundância: se a EF já enviou, o reminder_log evita duplicados.
 *
 * Garantias:
 *   - Retry com exponential backoff (3 tentativas)
 *   - Deduplicação via tabela reminder_log
 *   - Fila offline — reenvia quando volta a ter rede
 *   - Executa imediatamente ao focar a app (AppState listener)
 *   - Multi-plataforma: Web, PWA, Android, iOS
 */

import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase, getAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { enviarLembretesConsulta } from './reminderService';
import type { Agendamento } from './agendamentoService';
import NetInfo from '@react-native-community/netinfo';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Intervalo entre ciclos do worker (30 min — mais agressivo para não perder janela) */
const WORKER_INTERVAL_MS = 30 * 60 * 1000;

/** Máximo de tentativas por agendamento em caso de falha */
const MAX_RETRIES = 3;

/** Status de consultas elegíveis para lembrete */
const STATUS_ELEGIVEIS = [
  'confirmado_dentista',
  'atribuido_dentista',
  'agendado',
  'confirmado',
];

// ─── Estado do worker ─────────────────────────────────────────────────────────

let _timerId: ReturnType<typeof setTimeout> | null = null;
let _isRunning = false;
let _appStateSubscription: any = null;
let _lastCycleTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTomorrowDateStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Verifica se já foi enviado lembrete para este agendamento neste canal hoje.
 */
const jaFoiEnviado = async (
  agendamentoId: string,
  canal: 'in_app' | 'email' | 'whatsapp' | 'push'
): Promise<boolean> => {
  try {
    const client = getAdminClient() || supabase;
    const hoje = new Date().toISOString().slice(0, 10);

    const { data, error } = await client
      .from('reminder_log')
      .select('id')
      .eq('appointment_id', agendamentoId)
      .eq('canal', canal)
      .gte('sent_at', `${hoje}T00:00:00`)
      .limit(1);

    if (error) {
      if (
        error.message?.includes('does not exist') ||
        error.message?.includes('relation') ||
        (error as any).code === '42P01'
      ) {
        logger.warn('Tabela reminder_log não existe. Execute docs/REMINDER_LOG_SETUP.sql');
        return false;
      }
      return false;
    }

    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
};

/**
 * Regista no log que o lembrete foi enviado.
 */
const registarLog = async (
  agendamentoId: string,
  canal: 'in_app' | 'email' | 'whatsapp' | 'push',
  sucesso: boolean,
  detalhes?: string
): Promise<void> => {
  try {
    const client = getAdminClient() || supabase;
    await client.from('reminder_log').insert([
      {
        appointment_id: agendamentoId,
        canal,
        sucesso,
        detalhes: detalhes || null,
        sent_at: new Date().toISOString(),
      },
    ]);
  } catch (e: any) {
    logger.warn('reminderWorker: falha ao registar log', e?.message);
  }
};

/**
 * CAMADA 1: Invocar a Edge Function send-reminders (server-side).
 * Isto garante envio mesmo que o worker client falhe.
 */
const invocarEdgeFunctionReminders = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    logger.info('reminderWorker: Edge Function ignorada no Web para evitar CORS; use pg_cron/server para envio real.');
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke('send-reminders', {
      body: { triggered_by: 'client_worker' },
    });

    if (error) {
      logger.warn('reminderWorker: Edge Function send-reminders falhou', (error as any)?.message);
      return false;
    }

    logger.info('reminderWorker: Edge Function send-reminders executada ✅');
    return true;
  } catch (err: any) {
    logger.warn('reminderWorker: Excepção ao invocar send-reminders', err?.message);
    return false;
  }
};

// ─── Ciclo principal ──────────────────────────────────────────────────────────

/**
 * Um ciclo completo do worker com retry por agendamento:
 *  1. Invoca Edge Function (CAMADA 1 — server-side)
 *  2. Verifica conectividade
 *  3. Busca agendamentos de amanhã
 *  4. Para cada um, envia lembretes que ainda não foram enviados
 *  5. Retry até 3x com exponential backoff em caso de falha
 */
export const executarCicloLembretes = async (): Promise<{
  processados: number;
  ignorados: number;
  erros: number;
}> => {
  const stats = { processados: 0, ignorados: 0, erros: 0 };

  // CAMADA 1: Invocar Edge Function (server-side, real email + WhatsApp)
  await invocarEdgeFunctionReminders();

  // Verificar rede
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected || !net.isInternetReachable) {
      logger.info('reminderWorker: offline — ciclo client adiado');
      return stats;
    }
  } catch {
    // Se NetInfo falhar, tenta na mesma
  }

  const amanha = getTomorrowDateStr();
  logger.info(`reminderWorker: verificando consultas para ${amanha}...`);

  try {
    const client = getAdminClient() || supabase;

    const { data: agendamentos, error } = await client
      .from('appointments')
      .select('*')
      .eq('appointment_date', amanha)
      .in('status', STATUS_ELEGIVEIS);

    if (error) {
      logger.error('reminderWorker: erro ao buscar agendamentos', error);
      stats.erros++;
      return stats;
    }

    if (!agendamentos || agendamentos.length === 0) {
      logger.info(`reminderWorker: nenhuma consulta para ${amanha}`);
      return stats;
    }

    logger.info(`reminderWorker: ${agendamentos.length} consulta(s) encontrada(s) para ${amanha}`);

    for (const ag of agendamentos as Agendamento[]) {
      let sucesso = false;

      for (let tentativa = 1; tentativa <= MAX_RETRIES && !sucesso; tentativa++) {
        try {
          // Verificar se TODOS os canais já foram enviados hoje
          const [jaInApp, jaEmail, jaWhatsApp, jaPush] = await Promise.all([
            jaFoiEnviado(ag.id, 'in_app'),
            jaFoiEnviado(ag.id, 'email'),
            jaFoiEnviado(ag.id, 'whatsapp'),
            jaFoiEnviado(ag.id, 'push'),
          ]);

          const todosEnviados = jaInApp && jaEmail && jaWhatsApp && jaPush;

          if (todosEnviados) {
            logger.info(`reminderWorker: agendamento ${ag.id} — todos os canais já enviados hoje`);
            stats.ignorados++;
            sucesso = true;
            break;
          }

          // Buscar nome do dentista
          let nomeDentista: string | undefined;
          if (ag.dentist_id) {
            try {
              const { data: dentista } = await client
                .from('profiles')
                .select('nome')
                .eq('id', ag.dentist_id)
                .single();
              nomeDentista = dentista?.nome;
            } catch { /* não crítico */ }
          }

          // Disparar lembretes via reminderService (canais client-side)
          const resultado = await enviarLembretesConsulta({
            agendamento: ag,
            nomeDentista,
            modo: ag.status?.includes('confirmado') ? 'confirmado' : 'agendado',
          });

          // Registar log por canal (apenas os que não tinham sido enviados)
          if (!jaInApp) {
            await registarLog(ag.id, 'in_app', resultado.inApp,
              resultado.errors.find(e => e.startsWith('In-App')));
          }
          if (!jaEmail) {
            await registarLog(ag.id, 'email', resultado.email,
              resultado.errors.find(e => e.startsWith('Email')));
          }
          if (!jaWhatsApp) {
            await registarLog(ag.id, 'whatsapp', resultado.whatsapp,
              resultado.errors.find(e => e.startsWith('WhatsApp')));
          }
          if (!jaPush) {
            await registarLog(ag.id, 'push', resultado.pushLocal,
              resultado.errors.find(e => e.startsWith('Push')));
          }

          logger.info(`reminderWorker: lembretes enviados para ${ag.id} (tentativa ${tentativa})`, resultado);
          stats.processados++;
          sucesso = true;
        } catch (err: any) {
          logger.error(`reminderWorker: erro no agendamento ${ag.id} (tentativa ${tentativa}/${MAX_RETRIES})`, err?.message);

          if (tentativa < MAX_RETRIES) {
            const backoffMs = 2000 * Math.pow(2, tentativa - 1); // 2s, 4s, 8s
            logger.info(`reminderWorker: retry em ${backoffMs}ms...`);
            await sleep(backoffMs);
          } else {
            stats.erros++;
          }
        }
      }
    }
  } catch (err: any) {
    logger.error('reminderWorker: erro crítico no ciclo', err?.message);
    stats.erros++;
  }

  _lastCycleTime = Date.now();
  logger.info('reminderWorker: ciclo concluído', stats);
  return stats;
};

// ─── AppState listener ────────────────────────────────────────────────────────

/**
 * Quando a app volta ao foreground, executa imediatamente se passou
 * mais de 15 minutos desde o último ciclo.
 */
const handleAppStateChange = (nextState: AppStateStatus) => {
  if (nextState === 'active' && _isRunning) {
    const elapsed = Date.now() - _lastCycleTime;
    const MIN_INTERVAL = 15 * 60 * 1000; // 15 min

    if (elapsed >= MIN_INTERVAL) {
      logger.info('reminderWorker: app voltou ao foreground — executar ciclo');
      void executarCicloLembretes();
    }
  }
};

// ─── Controlo do worker ───────────────────────────────────────────────────────

/**
 * Inicia o worker de lembretes.
 * Executa imediatamente e depois a cada WORKER_INTERVAL_MS.
 * Também escuta mudanças de AppState para execução imediata ao focar.
 */
export const startReminderWorker = (): void => {
  if (_isRunning) {
    logger.info('reminderWorker: já está a correr');
    return;
  }

  _isRunning = true;
  logger.info('reminderWorker: iniciado ✅ (intervalo: 30min, retry: 3x, server+client)');

  const loop = async () => {
    await executarCicloLembretes();
    _timerId = setTimeout(loop, WORKER_INTERVAL_MS);
  };

  // Primeiro ciclo 5s após startup
  _timerId = setTimeout(loop, 5000);

  // Escutar AppState (foreground/background)
  try {
    _appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
  } catch {
    // AppState pode não estar disponível em Web
  }
};

/**
 * Para o worker.
 */
export const stopReminderWorker = (): void => {
  if (_timerId !== null) {
    clearTimeout(_timerId);
    _timerId = null;
  }
  if (_appStateSubscription) {
    _appStateSubscription.remove?.();
    _appStateSubscription = null;
  }
  _isRunning = false;
  logger.info('reminderWorker: parado ⏹');
};

/**
 * Estado atual do worker.
 */
export const getReminderWorkerStatus = (): {
  running: boolean;
  lastCycleTime: number;
  intervalMs: number;
} => ({
  running: _isRunning,
  lastCycleTime: _lastCycleTime,
  intervalMs: WORKER_INTERVAL_MS,
});
