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
  patient_id?: string;
  dentist_id?: string;
  secretary_id?: string;
  triagem_id?: string;
  appointment_date?: string;
  appointment_time?: string;
  tipo?: string; // Mantido para compatibilidade com o app (referente ao "symptoms" no sql ou tipo virtual)
  symptoms?: string;
  urgency?: string;
  priority?: string;
  notes?: string;
  reason?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  confirmed_at?: string;
  paciente?: Record<string, any>;
  dentista?: Record<string, any>;
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
    new Set(agendaBase.map((a) => a.patient_id).filter(Boolean))
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
    paciente: ag.paciente || pacientesById[ag.patient_id || ''] || undefined,
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
      symptoms: dados.symptoms || dados.tipo,
    };

    const runInsert = async (p: any) => {
      // Remover campos virtuais e garantir campos obrigatórios
      const { tipo, ...dadosLimpos } = p;
      
      const admin = getAdminClient();
      
      const payload = {
        patient_id: dadosLimpos.patient_id,
        appointment_date: dadosLimpos.appointment_date,
        appointment_time: dadosLimpos.appointment_time,
        notes: dadosLimpos.notes || dadosLimpos.observacoes || '',
        symptoms: dadosLimpos.symptoms || tipo || 'Consulta solicitada',
        status: dadosLimpos.status || 'agendamento_pendente_secretaria',
        priority: dadosLimpos.priority || 'normal',
        urgency: dadosLimpos.urgency || 'normal',
        triagem_id: dadosLimpos.triagem_id || null,
        dentist_id: dadosLimpos.dentist_id || null,
        secretary_id: dadosLimpos.secretary_id || null,
      };

      console.log('Tentando inserir agendamento:', payload);
      
      let res = admin
        ? await admin.from('appointments').insert([payload]).select().single()
        : await supabase.from('appointments').insert([payload]).select().single();
      
      if (res.error) {
        console.error('Erro na inserção:', res.error);
      }
      return res;
    };

    const { data, error } = await runInsert(dataWithStatus);

    if (error) {
      const msg = _handleTableMissing(error) || error.message || 'Erro desconhecido ao salvar no banco';
      return { success: false, error: msg };
    }

    logger.info('Agendamento criado com sucesso', data);
    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    console.error('Erro catch em criarAgendamento:', err);
    
    // OFFLINE HANDLING - Só tentamos se for erro de rede provável
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        console.log('📡 Offline: Enfileirando criação de agendamento...');
        await enqueueOfflineAction('criarAgendamento', { dados });
        return {
          success: true,
          data: { id: 'temp-' + Date.now(), ...dados, status: 'agendamento_pendente_secretaria', isPendingSync: true } as any
        };
      }
    } catch (netErr) {
      console.warn('Erro ao verificar NetInfo:', netErr);
    }

    const message = err.message || 'Erro inesperado no servidor';
    return { success: false, error: message };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('criarAgendamento', async (payload: { dados: any }) => {
  return criarAgendamento(payload.dados);
});

export const buscarAgendaDentista = async (
  dentistaId: string,
  date: Date | string
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    // Garantir uso correto da data recebida
    let start: Date;
    if (typeof date === 'string' && (date as string).length === 10) {
      const [y, m, d] = (date as string).split('-').map(Number);
      start = new Date(y, m - 1, d);
    } else {
      start = new Date(date);
    }
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // ✅ TIMEOUT + LIMIT 200 agendamentos - Buscar APENAS agendamentos atribuídos a este dentista
    // Usar datas em formato YYYY-MM-DD para comparação com DATE fields, resolvendo em timezone local
    const pad = (n: number) => String(n).padStart(2, '0');
    const startDate = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const endDate = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    
    const query = supabase
      .from('appointments')
      .select('*')
      .eq('dentist_id', dentistaId)
      .gte('appointment_date', startDate)
      .lt('appointment_date', endDate)
      .order('appointment_date', { ascending: true })
      .limit(200);
    
    const agendaRes = await withTimeout(query, 12000);

    if (agendaRes.error) throw agendaRes.error;

    const agendaBase = (agendaRes.data || []) as Agendamento[];
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
        .from('appointments')
        .select('*')
        .eq('dentist_id', dentistaId)
        .order('appointment_date', { ascending: false }), 10000),
      withTimeout(supabase
        .from('appointments')
        .select('patient_id')
        .in('status', ['pendente', 'agendado', 'confirmado'])
        .neq('dentist_id', dentistaId), 8000)
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
    // Usar datas em formato YYYY-MM-DD para comparação com DATE fields via timezone local
    const pad = (n: number) => String(n).padStart(2, '0');
    const getLocalYYYYMMDD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    const startDate = getLocalYYYYMMDD(dataInicio);
    const endDate = getLocalYYYYMMDD(dataFim);
    
    const { data, error } = await withTimeout(supabase
      .from('appointments')
      .select('*')
      .eq('dentist_id', dentistaId)
      .gte('appointment_date', startDate)
      .lt('appointment_date', endDate)
      .order('appointment_date', { ascending: false }), 10000);

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
    const admin = getAdminClient();
    const client = admin || supabase;
    
    const { data, error } = await client
      .from('appointments')
      .update({ status: 'atribuido_dentista', dentist_id: dentistaId, updated_at: new Date().toISOString() })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.patient_id) {
      await notificarAgendamentoPaciente(
        data.patient_id,
        'Pré-agendamento realizado',
        `Sua solicitação foi pré-agendada para ${formatDate(data.appointment_date, "dd/MM/yyyy 'às' HH:mm")}.
        `,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete da consulta',
        `Sua consulta está prevista para ${formatDate(data.appointment_date, "dd/MM/yyyy 'às' HH:mm")}.
        `,
        data.appointment_date
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
    const admin = getAdminClient();
    const client = admin || supabase;
    
    const { data, error } = await client
      .from('appointments')
      .update({ status: 'confirmado_dentista', dentist_id: dentistaId, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.patient_id) {
      await notificarAgendamentoPaciente(
        data.patient_id,
        'Consulta confirmada',
        `Seu agendamento foi confirmado para ${formatDate(data.appointment_date, "dd/MM/yyyy 'às' HH:mm")}.
        `,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete da consulta confirmada',
        `Sua consulta confirmada é em ${formatDate(data.appointment_date, "dd/MM/yyyy 'às' HH:mm")}.
        `,
        data.appointment_date
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
      .from('appointments')
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

    if (row?.patient_id) {
      await notificarAgendamentoPaciente(
        row.patient_id,
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
      .from('appointments')
      .select('*')
      .eq('patient_id', pacienteId)
      .order('appointment_date', { ascending: false }), 10000);

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
    .from('appointments')
    .select('notes')
    .eq('id', agendamentoId)
    .single();

  if (error || !data) {
    return nota;
  }

  const textoAtual = data.notes || '';
  return textoAtual ? `${textoAtual}\n${nota}` : nota;
};

export const buscarAgendamentosPendentes = async (): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('appointments')
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
      .from('appointments')
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

    const admin = getAdminClient();
    const client = admin || supabase;
    
    const { data, error } = await client
      .from('appointments')
      .update({ status: 'rejeitado_dentista', notes: observacoes, updated_at: new Date().toISOString() })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.patient_id) {
      await notificarAgendamentoPaciente(
        data.patient_id,
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

export const rejeitarSugestaoPaciente = async (
  agendamentoId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const admin = getAdminClient();
    const client = admin || supabase;
    
    const { data, error } = await client
      .from('appointments')
      .update({ 
        status: 'pendente',
        dentist_id: null,
        suggested_date: null,
        suggested_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    return { success: false, error: mapped || err.message };
  }
};

export const sugerirNovoHorario = async (
  agendamentoId: string,
  dentistaId: string,
  novoHorario: string,
  nota?: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    // Extrair data e hora do formato ISO
    // novoHorario vem como "2026-04-14T14:30:00.000Z"
    const dtObj = new Date(novoHorario);
    const appointmentDate = novoHorario.split('T')[0]; // "2026-04-14"
    const appointmentTime = `${String(dtObj.getHours()).padStart(2, '0')}:${String(dtObj.getMinutes()).padStart(2, '0')}`; // "14:30"

    const observacoes = await _appendObservacoes(
      agendamentoId,
      nota || `Novo horário sugerido pelo dentista: ${appointmentDate} às ${appointmentTime}`
    );

    const admin = getAdminClient();
    const client = admin || supabase;
    
    const { data, error } = await client
      .from('appointments')
      .update({ 
        status: 'reagendamento_solicitado', // Keep old date until patient confirms
        notes: observacoes, 
        dentist_id: dentistaId,
        suggested_by: dentistaId,
        suggested_date: novoHorario,
        updated_at: new Date().toISOString()
      })
      .eq('id', agendamentoId)
      .select()
      .single();

    if (error) throw error;

    if (data?.patient_id) {
      const formattedDate = `${appointmentDate} às ${appointmentTime}`;
      await notificarAgendamentoPaciente(
        data.patient_id,
        'Novo horário sugerido',
        `O dentista sugeriu um novo horário para sua consulta: ${formattedDate}. Por favor, confirme para reagendar.`,
        { agendamento_id: agendamentoId }
      );
      await scheduleAppointmentReminder(
        'Lembrete do novo horário sugerido',
        `Você tem uma consulta sugerida para ${formattedDate}. Confirme ou solicite nova data.`,
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

export const buscarValorEstimadoPlano = async (
  pacienteId: string,
  triagemId?: string
): Promise<{ estimado: number; concluido: number }> => {
  try {
    let query = supabase
      .from('planos_tratamento')
      .select('id')
      .eq('paciente_id', pacienteId);
      
    if (triagemId) {
      query = query.eq('triagem_id', triagemId);
    }
    
    // Pegar o plano mais recente
    const { data: planos } = await query.order('created_at', { ascending: false }).limit(1);

    if (!planos || planos.length === 0) {
      return { estimado: 0, concluido: 0 };
    }

    const planoId = planos[0].id;

    // Buscar procedimentos
    const { data: procedimentos } = await supabase
      .from('procedimentos_tratamento')
      .select('valor, status')
      .eq('plano_id', planoId);

    if (!procedimentos || procedimentos.length === 0) {
      return { estimado: 0, concluido: 0 };
    }

    let estimado = 0;
    let concluido = 0;

    procedimentos.forEach((p: any) => {
      const v = parseFloat(p.valor) || 0;
      estimado += v;
      if (p.status === 'concluido') {
        concluido += v;
      }
    });

    return { estimado, concluido };
  } catch (err) {
    console.error('Erro ao buscar valor estimado do plano:', err);
    return { estimado: 0, concluido: 0 };
  }
};

export const enrichAgendamentosComValorPlano = async (agendamentos: Agendamento[]): Promise<Agendamento[]> => {
  if (!agendamentos.length) return [];
  try {
    const pacienteIds = [...new Set(agendamentos.map(a => a.patient_id).filter(Boolean))];
    if (!pacienteIds.length) return agendamentos;

    const { data: planos } = await supabase
      .from('planos_tratamento')
      .select('id, paciente_id')
      .in('paciente_id', pacienteIds);

    if (!planos || planos.length === 0) return agendamentos;

    const planoIds = planos.map(p => p.id);
    const { data: procedimentos } = await supabase
      .from('procedimentos_tratamento')
      .select('plano_id, valor, status')
      .in('plano_id', planoIds);

    const procs = procedimentos || [];
    
    return agendamentos.map(agen => {
      if (!agen.patient_id) return agen;
      const pacientePlanos = planos.filter(p => p.paciente_id === agen.patient_id);
      if (!pacientePlanos.length) return agen;

      // Pegamos todos os procedimentos deste paciente (através dos planos)
      const pIds = pacientePlanos.map(p => p.id);
      const mProcs = procs.filter(p => pIds.includes(p.plano_id));
      
      let estimado = 0;
      for (const p of mProcs) {
        estimado += parseFloat(p.valor) || 0;
      }
      
      if (estimado > 0) {
        return { ...agen, valor_estimado_plano: estimado };
      }
      return agen;
    });
  } catch (err) {
    console.warn('Erro ao enriquecer com valor de plano', err);
    return agendamentos;
  }
};

/**
 * Atualiza campos arbitrários de um agendamento (uso paciente/interno)
 */
export const updateAgendamento = async (
  agendamentoId: string,
  payload: Partial<Record<string, any>>
): Promise<ServiceResult<null>> => {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', agendamentoId);
    if (error) throw error;
    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao actualizar agendamento' };
  }
};
