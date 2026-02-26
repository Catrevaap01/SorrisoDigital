/**
 * Operações relacionadas a agendamentos de consultas
 */

import { supabase } from '../config/supabase';
import { HandledError, handleError } from '../utils/errorHandler';
import { logger } from '../utils/logger';

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
  } catch (err) {
    const message = (err as any)?.message || 'Erro desconhecido';
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

    const { data, error } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('dentista_id', dentistaId)
      .gte('data_agendamento', start.toISOString())
      .lt('data_agendamento', end.toISOString())
      .order('data_agendamento', { ascending: true });

    if (error) throw error;

    return { success: true, data: data as Agendamento[] };
  } catch (err) {
    const message = (err as any)?.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};
