/**
 * Hook para gerenciar agendamentos
 * Encapsula lógica de busca e manipulação de agendamentos
 */

import { useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

export interface Agendamento {
  id: string;
  paciente_id: string;
  dentista_id: string;
  data_agendamento: string;
  hora_agendamento: string;
  status?: 'agendado' | 'concluido' | 'cancelado';
  motivo?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface UseAgendamentosResult {
  agendamentos: Agendamento[];
  loading: boolean;
  error: HandledError | null;
  buscarAgendamentos: (filtros?: Record<string, any>) => Promise<{ success: boolean; data?: Agendamento[]; error?: HandledError }>;
  criar: (dados: Omit<Agendamento, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; data?: Agendamento; error?: HandledError }>;
  atualizar: (id: string, dados: Partial<Agendamento>) => Promise<{ success: boolean; data?: Agendamento; error?: HandledError }>;
  deletar: (id: string) => Promise<{ success: boolean; error?: HandledError }>;
}

export const useAgendamentos = (pacienteId: string | null = null): UseAgendamentosResult => {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<HandledError | null>(null);

  /**
   * Buscar agendamentos
   */
  const buscarAgendamentos = useCallback(
    async (filtros: Record<string, any> = {}): Promise<{ success: boolean; data?: Agendamento[]; error?: HandledError }> => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from('agendamentos').select('*');

        if (pacienteId) {
          query = query.eq('paciente_id', pacienteId);
        }

        // Aplicar filtros adicionais
        Object.entries(filtros).forEach(([key, value]) => {
          query = query.eq(key, value);
        });

        query = query.order('data_agendamento', { ascending: true });

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        setAgendamentos(data as Agendamento[] || []);
        logger.info('Agendamentos buscados com sucesso');
        return { success: true, data: data as Agendamento[] };
      } catch (err) {
        const handledError = handleError(err, 'useAgendamentos.buscarAgendamentos');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [pacienteId]
  );

  /**
   * Criar novo agendamento
   */
  const criar = useCallback(
    async (dados: Omit<Agendamento, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Agendamento; error?: HandledError }> => {
      try {
        setLoading(true);

        const { data, error: createError } = await supabase
          .from('agendamentos')
          .insert([dados])
          .select()
          .single();

        if (createError) throw createError;

        setAgendamentos([...agendamentos, data as Agendamento]);
        logger.info('Agendamento criado com sucesso');
        return { success: true, data: data as Agendamento };
      } catch (err) {
        const handledError = handleError(err, 'useAgendamentos.criar');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [agendamentos]
  );

  /**
   * Atualizar agendamento
   */
  const atualizar = useCallback(
    async (id: string, dados: Partial<Agendamento>): Promise<{ success: boolean; data?: Agendamento; error?: HandledError }> => {
      try {
        setLoading(true);

        const { data, error: updateError } = await supabase
          .from('agendamentos')
          .update(dados)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        setAgendamentos(agendamentos.map((a) => (a.id === id ? (data as Agendamento) : a)));
        logger.info('Agendamento atualizado com sucesso');
        return { success: true, data: data as Agendamento };
      } catch (err) {
        const handledError = handleError(err, 'useAgendamentos.atualizar');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [agendamentos]
  );

  /**
   * Deletar agendamento
   */
  const deletar = useCallback(
    async (id: string): Promise<{ success: boolean; error?: HandledError }> => {
      try {
        setLoading(true);

        const { error: deleteError } = await supabase
          .from('agendamentos')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        setAgendamentos(agendamentos.filter((a) => a.id !== id));
        logger.info('Agendamento deletado com sucesso');
        return { success: true };
      } catch (err) {
        const handledError = handleError(err, 'useAgendamentos.deletar');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [agendamentos]
  );

  return {
    agendamentos,
    loading,
    error,
    buscarAgendamentos,
    criar,
    atualizar,
    deletar,
  };
};

export default useAgendamentos;
