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

    // traz agendamentos atribuídos a este dentista OU ainda não confirmados (status agendado)
    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .or(`dentista_id.eq.${dentistaId},status.eq.agendado`)
      .gte('data_agendamento', start.toISOString())
      .lt('data_agendamento', end.toISOString())
      .order('data_agendamento', { ascending: true });

    if (error) throw error;

    return { success: true, data: data as Agendamento[] };
  } catch (err: any) {
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

/**
 * Marca um agendamento como confirmado pelo dentista.
 * Atualiza o status para 'confirmado' e garante que o dentista_id esteja definido.
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
    const mapped = _handleTableMissing(err);
    const message = mapped || err.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

/**
 * Cancela um agendamento e o devolve ao pool geral.
 * Reverte o status para 'agendado' e remove a associação de dentista.
 */
export const cancelarAgendamento = async (
  agendamentoId: string
): Promise<ServiceResult<Agendamento>> => {
  try {
    const { data, error } = await supabase
      .from('agendamentos')
      .update({ status: 'agendado', dentista_id: null })
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
