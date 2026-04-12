/**

 * Operações relacionadas a agendamentos de consultas
 */

import { supabase, getAdminClient } from '../config/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { withTimeout } from '../utils/withTimeout';
import { formatDate } from '../utils/helpers';
import { HandledError, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { notificarAgendamentoPaciente } from './notificacoesService';
import { scheduleAppointmentReminder } from './localNotificationService';
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineAction, registerSyncHandler } from './offlineSyncService';

// helper para detectar falta da tabela agendamentos e informar o usuário
function _handleTableMissing(error: any): string | null {
  const msg: string = error?.message || '';
  if (msg.toLowerCase().includes('could not find table')) {
    return 'Tabela de agendamentos não existe. Rode o script de migração.';
  }
  if (msg.toLowerCase().includes('does not exist')) {
    return 'Banco de dados não tem a tabela esperada. Verifique a migração.';
  }
  return null;
}

export interface Agendamento {
  id: string;
  paciente_id?: string;
  dentista_id?: string;
  data_agendamento: string;
  tipo?: string;
  observacoes?: string;
  status?: string;
  prioridade?: string;
  created_at?: string;
  updated_at?: string;
  paciente?: Record<string, any>;
  [key: string]: any;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string | import('../utils/errorHandler').HandledError;
}

const enrichAgendamentosWithPacientes = async (
  agendaBase: Agendamento[]
): Promise<Agendamento[]> => {
  const pacienteIds = Array.from(
    new Set(agendaBase.map((a) => a.paciente_id).filter(Boolean))
  ) as string[];

    let pacientesById: Record<string, any> = {};
    if (pacienteIds.length > 0) {
      const { data: pacientes = [], error: pacientesError } = await supabase
        .from('profiles')
        .select('id, nome, telefone, email')
        .in('id', pacienteIds);

      if (!pacientesError && pacientes.length > 0) {
        pacientesById = Object.fromEntries(pacientes.map((p: any) => [p.id, p]));
      }
    }

  return agendaBase.map((ag) => ({
    ...ag,
    paciente: ag.paciente || pacientesById[ag.paciente_id || ''] || undefined,
  }));
};

export const criarAgendamento = async (
  dados: Omit<Agendamento, 'id' | 'created_at' | 'updated_at'>
): Promise<ServiceResult<Agendamento>> => {
  try {
    // Garantir que agendamentos começam na fila da secretária
    const dataWithStatus = {
      ...dados,
      status: 'agendamento_pendente_secretaria' as any,
    };

    const runInsert = async (p: any) => {
      let res = await supabase.from('agendamentos').insert([p]).select().single();
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) res = await admin.from('agendamentos').insert([p]).select().single();
      }
      return res;
    };

    const { data, error } = await runInsert(dataWithStatus);

    if (error) throw error;

    logger.info('Agendamento criado na fila da secretária', data);
    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando criação de agendamento...');
      await enqueueOfflineAction('criarAgendamento', { dados });
      return {
        success: true,
        data: {
          id: 'temp-' + Date.now(),
          ...dados,
          status: 'agendamento_pendente_secretaria',
          created_at: new Date().toISOString(),
          isPendingSync: true,
        } as any
      };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('criarAgendamento', async (payload: { dados: any }) => {
  return criarAgendamento(payload.dados);
});

export const buscarAgendaDentista = async (
  dentistaId: string,
  date: Date
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // ✅ TIMEOUT + LIMIT 200 agendamentos  
    const query = supabase
      .from('agendamentos')
      .select('*')
      .limit(200)
      .or(`dentista_id.eq.${dentistaId},status.eq.pendente,status.eq.agendado,status.eq.confirmado,status.eq.realizado,status.eq.cancelado`)
      .gte('data_agendamento', start.toISOString())
      .lt('data_agendamento', end.toISOString())
      .order('data_agendamento', { ascending: true });
    
    const [agendaRes, bloqueadosRes] = await Promise.all([
      withTimeout(query, 12000),
      supabase
        .from('agendamentos')
        .select('paciente_id')
        .in('status', ['pendente', 'agendado', 'confirmado'])
        .neq('dentista_id', dentistaId)
        .gte('data_agendamento', start.toISOString())
        .lt('data_agendamento', end.toISOString())
    ]);

    if (agendaRes.error) throw agendaRes.error;

    let agendaBase = (agendaRes.data || []) as Agendamento[];
    const pacientesBloqueados = new Set(
      (bloqueadosRes.data || []).map((b: any) => b.paciente_id).filter(Boolean)
    );

    agendaBase = agendaBase.filter((ag) => {
      if (ag.dentista_id === dentistaId) return true;
      if (!ag.paciente_id) return true;
      return !pacientesBloqueados.has(ag.paciente_id);
    });
    
    const agendaEnriquecida = await enrichAgendamentosWithPacientes(agendaBase);

    return { success: true, data: agendaEnriquecida };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

/**
 * Busca todos os agendamentos de um dentista (sem filtro de data).
 * Usado para relatórios.
 */
export const buscarTodosAgendamentosDentista = async (
  dentistaId: string
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const [agendaRes, bloqueadosRes] = await Promise.all([
      withTimeout(supabase
        .from('agendamentos')
        .select('*')
        .eq('dentista_id', dentistaId)
        .order('data_agendamento', { ascending: false }), 10000),
      withTimeout(supabase
        .from('agendamentos')
        .select('paciente_id')
        .in('status', ['pendente', 'agendado', 'confirmado'])
        .neq('dentista_id', dentistaId), 8000)
    ]);

    if (agendaRes.error) throw agendaRes.error;

    let agendaBase = (agendaRes.data || []) as Agendamento[];
    const pacientesBloqueados = new Set(
      (bloqueadosRes.data || []).map((b: any) => b.paciente_id).filter(Boolean)
    );

    // Filtra pacientes bloqueados
    agendaBase = agendaBase.filter((ag) => {
      if (ag.dentista_id === dentistaId) return true;
      if (!ag.paciente_id) return true;
      return !pacientesBloqueados.has(ag.paciente_id);
    });

    const agendaEnriquecida = await enrichAgendamentosWithPacientes(agendaBase);

    return { success: true, data: agendaEnriquecida };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

export const buscarAgendamentosDentistaPorPeriodo = async (
  dentistaId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const { data, error } = await withTimeout(supabase
      .from('agendamentos')
      .select('*')
      .eq('dentista_id', dentistaId)
      .gte('data_agendamento', dataInicio.toISOString())
      .lt('data_agendamento', dataFim.toISOString())
      .order('data_agendamento', { ascending: false }), 10000);

    if (error) throw error;

    const agendaEnriquecida = await enrichAgendamentosWithPacientes(
      (data || []) as Agendamento[]
    );

    return { success: true, data: agendaEnriquecida };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};


/**
 * Marca um agendamento como confirmado pelo dentista.
 * Atualiza o status para 'agendado' e garante que o dentista_id esteja definido.
 */
export const agendarAgendamento = async (
  agendamentoId: string,
  dentistaId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'agendado', dentista_id: dentistaId })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.paciente_id) {
      await notificarAgendamentoPaciente(
        data.paciente_id,
        'Pré-agendamento realizado',
        `Sua solicitação foi pré-agendada para ${formatDate(new Date(data.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}.
        `,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete da consulta',
        `Sua consulta está prevista para ${formatDate(new Date(data.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}.
        `,
        data.data_agendamento
      );
    }

    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando agendamento (confirmado)...');
      await enqueueOfflineAction('agendarAgendamento', { agendamentoId, dentistaId });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('agendarAgendamento', async (payload: any) => {
  return agendarAgendamento(payload.agendamentoId, payload.dentistaId);
});

/**
 * Marca um agendamento como confirmado definitivamente.
 * Atualiza o status para 'confirmado'.
 */
export const confirmarAgendamento = async (
  agendamentoId: string,
  dentistaId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'confirmado', dentista_id: dentistaId })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.paciente_id) {
      await notificarAgendamentoPaciente(
        data.paciente_id,
        'Consulta confirmada',
        `Seu agendamento foi confirmado para ${formatDate(new Date(data.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}.
        `,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete da consulta confirmada',
        `Sua consulta confirmada é em ${formatDate(new Date(data.data_agendamento), "dd/MM/yyyy 'às' HH:mm")}.
        `,
        data.data_agendamento
      );
    }

    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando confirmação de agendamento...');
      await enqueueOfflineAction('confirmarAgendamento', { agendamentoId, dentistaId });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('confirmarAgendamento', async (payload: any) => {
  return confirmarAgendamento(payload.agendamentoId, payload.dentistaId);
});

/**
 * Marca um agendamento como realizado (concluído).
 * Atualiza o status para 'realizado'.
 */
export const realizarAgendamento = async (
  agendamentoId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'realizado', updated_at: new Date().toISOString() })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    logger.info('Agendamento marcado como realizado', data);
    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando realização de agendamento...');
      await enqueueOfflineAction('realizarAgendamento', { agendamentoId });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('realizarAgendamento', async (payload: any) => {
  return realizarAgendamento(payload.agendamentoId);
});

/**
 * Cancela um agendamento e o devolve ao pool geral.
 * Reverte o status para 'pendente' e remove a associação de dentista.
 */
export const cancelarAgendamento = async (
  agendamentoId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase.rpc('cancelar_agendamento_dentista', {
      p_agendamento_id: agendamentoId,
    });

    if (error) {
      // fallback com mensagem orientativa caso a funcao ainda nao exista
      if ((error as any).code === '42883') {
        return {
          success: false,
          error:
            'Funcao SQL cancelar_agendamento_dentista nao encontrada. Execute o script docs/SUPABASE_FIX_COMPLETO_RLS.sql atualizado.',
        };
      }
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (row?.paciente_id) {
      await notificarAgendamentoPaciente(
        row.paciente_id,
        'Agendamento suspenso',
        'Seu agendamento foi devolvido à fila e será reavaliado pela recepção.',
        { agendamento_id: agendamentoId }
      );
    }

    return { success: true, data: row as Agendamento };
  } catch (err: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando cancelamento de agendamento...');
      await enqueueOfflineAction('cancelarAgendamento', { agendamentoId });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('cancelarAgendamento', async (payload: any) => {
  return cancelarAgendamento(payload.agendamentoId);
});

/**
 * Busca agendamentos de um paciente específico.
 * Traz todos os agendamentos do paciente ordenados por data.
 */
export const buscarAgendamentosPaciente = async (
  pacienteId: string
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    // Busca agendamentos do paciente
    const { data, error } = await withTimeout(supabase
      .from('agendamentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('data_agendamento', { ascending: false }), 10000);

    if (error) throw error;

    // Se não há dados, retorna array vazio
    if (!data || data.length === 0) {
      return { success: true, data: [] };
    }

    // Busca informações do dentista se existir
    const dentistIds = [...new Set(data.map((a) => a.dentista_id).filter(Boolean))];
    
    let dentistasById: Record<string, any> = {};
    if (dentistIds.length > 0) {
      const { data: dentistas, error: dentistasError } = await supabase
        .from('profiles')
        .select('id, nome, especialidade')
        .in('id', dentistIds);

      if (!dentistasError && dentistas) {
        dentistasById = Object.fromEntries(dentistas.map((d: any) => [d.id, d]));
      }
    }

    // Enriquecer dados com informações do dentista
    const agendamentosEnriquecidos = data.map((ag) => ({
      ...ag,
      dentista: ag.dentista_id ? dentistasById[ag.dentista_id] : null,
    }));

    return { success: true, data: agendamentosEnriquecidos as Agendamento[] };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

const _appendObservacoes = async (
  agendamentoId: string,
  nota: string
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('agendamentos')
    .select('observacoes')
    .eq('id', agendamentoId)
    .single();

  if (error || !data) {
    return nota;
  }

  const textoAtual = data.observacoes || '';
  return textoAtual ? `${textoAtual}\n${nota}` : nota;
};

export const buscarAgendamentosPendentes = async (): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('agendamentos')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
      10000
    );

    if (error) throw error;

    const agendamentos = await enrichAgendamentosWithPacientes((data || []) as Agendamento[]);
    return { success: true, data: agendamentos };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

export const buscarAgendamentoPorId = async (
  agendamentoId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('id', agendamentoId)
      .single();

    if (error) throw error;
    if (!data) {
      return { success: false, error: 'Agendamento não encontrado' };
    }

    const [agendamento] = await enrichAgendamentosWithPacientes([data as Agendamento]);
    return { success: true, data: agendamento };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

export const rejeitarAgendamento = async (
  agendamentoId: string,
  motivo: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const observacoes = await _appendObservacoes(
      agendamentoId,
      `Rejeitado pelo dentista: ${motivo}`
    );

    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'rejeitado', observacoes })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.paciente_id) {
      await notificarAgendamentoPaciente(
        data.paciente_id,
        'Agendamento rejeitado',
        'O dentista rejeitou sua consulta. Por favor, aguarde nova resposta do secretário.',
        { agendamento_id: agendamentoId }
      );
    }

    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando rejeição de agendamento...');
      await enqueueOfflineAction('rejeitarAgendamento', { agendamentoId, motivo });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

registerSyncHandler('rejeitarAgendamento', async (payload: any) => {
  return rejeitarAgendamento(payload.agendamentoId, payload.motivo);
});

export const sugerirNovoHorario = async (
  agendamentoId: string,
  dentistaId: string,
  novoHorario: string,
  nota?: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const observacoes = await _appendObservacoes(
      agendamentoId,
      nota || `Novo horário sugerido pelo dentista: ${novoHorario}`
    );

    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'sugerido', data_agendamento: novoHorario, observacoes, dentista_id: dentistaId })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.paciente_id) {
      await notificarAgendamentoPaciente(
        data.paciente_id,
        'Novo horário sugerido',
        `O dentista sugeriu um novo horário para sua consulta: ${formatDate(new Date(novoHorario), "dd/MM/yyyy 'às' HH:mm")}.`,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete do novo horário sugerido',
        `Você tem uma consulta sugerida para ${formatDate(new Date(novoHorario), "dd/MM/yyyy 'às' HH:mm")}. Confirme ou solicite nova data.`,
        novoHorario
      );
    }

    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando sugestão de horário...');
      await enqueueOfflineAction('sugerirNovoHorario', { agendamentoId, dentistaId, novoHorario, nota });
      return { success: true };
    }

    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

registerSyncHandler('sugerirNovoHorario', async (payload: any) => {
  return sugerirNovoHorario(payload.agendamentoId, payload.dentistaId, payload.novoHorario, payload.nota);
});
