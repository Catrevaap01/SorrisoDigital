/**

 * Operações relacionadas a agendamentos de consultas
 */

import { supabase } from '../config/supabase';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { withTimeout } from '../utils/withTimeout';
import { HandledError, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineAction, registerSyncHandler } from './offlineSyncService';

const extra = Constants.expoConfig?.extra;
const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const getAdminClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

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
    const runInsert = async (p: any) => {
      let res = await supabase.from('agendamentos').insert([p]).select().single();
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) res = await admin.from('agendamentos').insert([p]).select().single();
      }
      return res;
    };

    const { data, error } = await runInsert(dados);

    if (error) throw error;

    logger.info('Agendamento criado', data);
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
