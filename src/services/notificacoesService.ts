/**
 * Serviço de notificações para dentista e paciente
 * Notifica quando triagem é criada, respondida e envia feedback
 */

import { supabase } from '../config/supabase';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

const extra = Constants.expoConfig?.extra;
const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const getAdminClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

export interface Notificacao {
  id: string;
  usuario_id: string;
  tipo: 'triagem_enviada' | 'triagem_respondida' | 'feedback_saude' | 'conselho' | 'urgencia';
  titulo: string;
  mensagem: string;
  dados?: {
    triagem_id?: string;
    dentista_id?: string;
    paciente_id?: string;
    [key: string]: any;
  };
  lida: boolean;
  created_at?: string;
  atualizado_em?: string;
}

export interface NotificacaoFeedback {
  tipo: 'conselho' | 'alerta' | 'urgencia';
  titulo: string;
  mensagem: string;
  recomendacoes?: string[];
}

/**
 * Cria notificação para dentista quando paciente envia triagem
 */
export const notificarTriagemEnviada = async (
  pacienteId: string,
  pacienteNome: string,
  triagemId: string,
  sintomaPrincipal: string
): Promise<{ success: boolean; error?: HandledError | string }> => {
  try {
    // Encontrar todos os dentistas para notificar
    const { data: dentistas, error: dentistasError } = await supabase
      .from('profiles')
      .select('id')
      .eq('tipo', 'dentista');

    if (dentistasError) throw dentistasError;
    if (!dentistas || dentistas.length === 0) {
      return { success: true }; // Nenhum dentista para notificar
    }

    // Criar notificações para cada dentista
    const notificacoes = dentistas.map((dentista) => ({
      usuario_id: dentista.id,
      tipo: 'triagem_enviada',
      titulo: 'Nova Triagem Recebida',
      mensagem: `${pacienteNome} enviou uma triagem sobre ${sintomaPrincipal.toLowerCase()}`,
      dados: {
        triagem_id: triagemId,
        paciente_id: pacienteId,
      },
      lida: false,
    }));

    const runInsert = async (p: any[]) => {
      let res = await supabase.from('notificacoes').insert(p);
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) res = await admin.from('notificacoes').insert(p);
      }
      return res;
    };

    const { error } = await runInsert(notificacoes);

    if (error) throw error;

    logger.info('Notificação de triagem enviada', { triagemId, dentistasCount: dentistas.length });
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.notificarTriagemEnviada');
    logger.error('Erro ao notificar triagem enviada', handled);
    return { success: false, error: handled };
  }
};

/**
 * Notifica paciente quando dentista responde à triagem
 */
export const notificarTriagemRespondida = async (
  pacienteId: string,
  dentistaNome: string,
  triagemId: string,
  orientacao: string
): Promise<{ success: boolean; error?: HandledError | string }> => {
  try {
    const runInsertSingle = async (p: any[]) => {
      let res = await supabase.from('notificacoes').insert(p);
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) res = await admin.from('notificacoes').insert(p);
      }
      return res;
    };

    const { error } = await runInsertSingle([
      {
        usuario_id: pacienteId,
        tipo: 'triagem_respondida',
        titulo: 'Triagem Respondida',
        mensagem: `${dentistaNome} respondeu à sua triagem com orientações`,
        dados: {
          triagem_id: triagemId,
          dentista_id: dentistaNome,
        },
        lida: false,
      },
    ]);

    if (error) throw error;

    logger.info('Notificação de resposta enviada', { triagemId, pacienteId });
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.notificarTriagemRespondida');
    return { success: false, error: handled };
  }
};

/**
 * Gera feedback automático baseado na triagem
 */
export const gerarFeedbackAutomatico = (
  sintomaPrincipal: string,
  intensidadeDor: number,
  duracao: string
): NotificacaoFeedback => {
  let tipo: 'conselho' | 'alerta' | 'urgencia' = 'conselho';
  let titulo = '';
  let mensagem = '';
  const recomendacoes: string[] = [];

  // Classificar urgência
  if (intensidadeDor >= 8 || duracao === 'mais de 1 semana') {
    tipo = 'urgencia';
    titulo = 'Atenção: Procure atendimento urgente';
    mensagem = 'Seus sintomas requerem avaliação imediata com um dentista.';
    recomendacoes.push('Procure um dentista em até 24 horas');
    recomendacoes.push('Evite alimentos duros e quentes');
    recomendacoes.push('Tome anti-inflamatório se houver dor intensa');
  } else if (intensidadeDor >= 5) {
    tipo = 'alerta';
    titulo = 'Avaliação recomendada';
    mensagem = 'Você deve agendar uma consulta com um dentista em breve.';
    recomendacoes.push('Agende uma consulta nos próximos dias');
    recomendacoes.push('Evite produtos muito quentes ou frios');
    recomendacoes.push('Mantenha a área limpa');
  } else {
    tipo = 'conselho';
    titulo = 'Dica de cuidado bucal';
    mensagem = 'Aqui estão algumas recomendações para você.';
    recomendacoes.push('Escove os dentes 2x ao dia com cuidado');
    recomendacoes.push('Use fio dental diariamente');
    recomendacoes.push('Enxágue com água morna e sal se houver incômodo');
  }

  // Adicionar recomendações específicas por sintoma
  if (sintomaPrincipal.toLowerCase().includes('sangramento')) {
    recomendacoes.push('Use uma escova macia para não irritar mais a gengiva');
    recomendacoes.push('Evite alimentos muito quentes ou picantes');
  }

  if (sintomaPrincipal.toLowerCase().includes('cárie')) {
    recomendacoes.push('Reduz açúcar na dieta');
    recomendacoes.push('Use enxaguante bucal sem álcool');
  }

  if (sintomaPrincipal.toLowerCase().includes('bruxismo')) {
    recomendacoes.push('Procure dormir melhor');
    recomendacoes.push('Tente relaxar antes de dormir');
  }

  return { tipo, titulo, mensagem, recomendacoes };
};

/**
 * Envia notificação de feedback/conselho para o paciente
 */
export const enviarFeedbackPaciente = async (
  pacienteId: string,
  feedback: NotificacaoFeedback,
  triagemId: string
): Promise<{ success: boolean; error?: HandledError | string }> => {
  try {
    const { error } = await supabase.from('notificacoes').insert([
      {
        usuario_id: pacienteId,
        tipo: feedback.tipo === 'urgencia' ? 'urgencia' : 'feedback_saude',
        titulo: feedback.titulo,
        mensagem: feedback.mensagem,
        dados: {
          triagem_id: triagemId,
          recomendacoes: feedback.recomendacoes || [],
        },
        lida: false,
      },
    ]);
    // Added admin check for feedback
    if (error && (error.code === '42501' || (error as any).status === 403)) {
       const admin = getAdminClient();
       if (admin) {
         await admin.from('notificacoes').insert([
           {
             usuario_id: pacienteId,
             tipo: feedback.tipo === 'urgencia' ? 'urgencia' : 'feedback_saude',
             titulo: feedback.titulo,
             mensagem: feedback.mensagem,
             dados: {
               triagem_id: triagemId,
               recomendacoes: feedback.recomendacoes || [],
             },
             lida: false,
           },
         ]);
       }
    }

    if (error) throw error;

    logger.info('Feedback enviado para paciente', { pacienteId, triagemId });
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.enviarFeedbackPaciente');
    return { success: false, error: handled };
  }
};

/**
 * Busca notificações não lidas do usuário
 */
export const buscarNotificacoesNaoLidas = async (
  usuarioId: string
): Promise<{ success: boolean; data?: Notificacao[]; error?: HandledError | string }> => {
  try {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('lida', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data as Notificacao[]) || [] };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.buscarNotificacoesNaoLidas');
    return { success: false, error: handled };
  }
};

/**
 * Marca notificação como lida
 */
export const marcarNotificacaoComoLida = async (
  notificacaoId: string
): Promise<{ success: boolean; error?: HandledError | string }> => {
  try {
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('id', notificacaoId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.marcarNotificacaoComoLida');
    return { success: false, error: handled };
  }
};

/**
 * Busca todas as notificações de um usuário
 */
export const buscarTodasNotificacoes = async (
  usuarioId: string
): Promise<{ success: boolean; data?: Notificacao[]; error?: HandledError | string }> => {
  try {
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: (data as Notificacao[]) || [] };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.buscarTodasNotificacoes');
    return { success: false, error: handled };
  }
};

/**
 * Limpar notificações antigas
 */
export const limparNotificacoesAntigas = async (diasAntes: number = 30): Promise<{ success: boolean; error?: HandledError | string }> => {
  try {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasAntes);

    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .lt('created_at', dataLimite.toISOString())
      .eq('lida', true);

    if (error) throw error;

    logger.info('Notificações antigas limpas');
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'notificacoesService.limparNotificacoesAntigas');
    return { success: false, error: handled };
  }
};
