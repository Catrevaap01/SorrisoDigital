/**
 * Operações relacionadas a agendamentos de consultas
 */

import { supabase } from '../config/supabase';
import { HandledError, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

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
  error?: string;
}

export const criarAgendamento = async (
  dados: Omit<Agendamento, 'id' | 'created_at' | 'updated_at'>
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([dados])
      .select()
      .single();

    if (error) throw error;

    logger.info('Agendamento criado', data);
    return { success: true, data: data as Agendamento };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

export const buscarAgendaDentista = async (
  dentistaId: string,
  date: Date
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    // traz agendamentos atribuídos a este dentista OU pendentes de confirmação
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .or(`dentista_id.eq.${dentistaId},status.eq.pendente`)
      .gte('data_agendamento', start.toISOString())
      .lt('data_agendamento', end.toISOString())
      .order('data_agendamento', { ascending: true });

    if (error) throw error;

    let agendaBase = (data || []) as Agendamento[];

    const { data: bloqueados } = await supabase
      .from('agendamentos')
      .select('paciente_id')
      .in('status', ['agendado', 'confirmado'])
      .neq('dentista_id', dentistaId)
      .gte('data_agendamento', start.toISOString())
      .lt('data_agendamento', end.toISOString());

    const pacientesBloqueados = new Set(
      (bloqueados || []).map((b: any) => b.paciente_id).filter(Boolean)
    );

    agendaBase = agendaBase.filter((ag) => {
      if (ag.dentista_id === dentistaId) return true;
      if (!ag.paciente_id) return true;
      return !pacientesBloqueados.has(ag.paciente_id);
    });
    const pacienteIds = Array.from(
      new Set(agendaBase.map((a) => a.paciente_id).filter(Boolean))
    ) as string[];

    let pacientesById: Record<string, any> = {};
    if (pacienteIds.length > 0) {
      const { data: pacientes, error: pacientesError } = await supabase
        .from('profiles')
        .select('id, nome, telefone, email')
        .in('id', pacienteIds);

      if (!pacientesError && pacientes) {
        pacientesById = Object.fromEntries(pacientes.map((p: any) => [p.id, p]));
      }
    }

    const agendaEnriquecida = agendaBase.map((ag) => ({
      ...ag,
      paciente: ag.paciente || pacientesById[ag.paciente_id || ''] || undefined,
    }));

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
export const confirmarAgendamento = async (
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
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

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
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

/**
 * Busca agendamentos de um paciente específico.
 * Traz todos os agendamentos do paciente ordenados por data.
 */
export const buscarAgendamentosPaciente = async (
  pacienteId: string
): Promise<ServiceResult<Agendamento[]>> => {
  try {
    // Busca agendamentos do paciente
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('data_agendamento', { ascending: false });

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
