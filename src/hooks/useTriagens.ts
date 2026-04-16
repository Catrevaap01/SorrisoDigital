/**
 * Hook para gerenciar triagens
 * Encapsula lógica de busca e manipulação de triagens
 */

import { useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

export interface Triagem {
  id: string;
  paciente_id: string;
  data_triagem: string;
  status_oral?: string;
  higiene_oral?: string;
  halitose?: boolean;
  sangramentos?: boolean;
  problemas_dentarios?: string;
  recomendacoes?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface UseTriagensResult {
  triagens: Triagem[];
  loading: boolean;
  error: HandledError | null;
  buscarTriagens: (filtros?: Record<string, any>) => Promise<{ success: boolean; data?: Triagem[]; error?: HandledError }>;
  criar: (dados: Omit<Triagem, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; data?: Triagem; error?: HandledError }>;
  atualizar: (id: string, dados: Partial<Triagem>) => Promise<{ success: boolean; data?: Triagem; error?: HandledError }>;
}

export const useTriagens = (pacienteId: string | null = null): UseTriagensResult => {
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<HandledError | null>(null);

  /**
   * Buscar triagens
   */
  const buscarTriagens = useCallback(
    async (filtros: Record<string, any> = {}): Promise<{ success: boolean; data?: Triagem[]; error?: HandledError }> => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from('triagens').select('*');

        if (pacienteId) {
          query = query.eq('paciente_id', pacienteId);
        }

        Object.entries(filtros).forEach(([key, value]) => {
          query = query.eq(key, value);
        });

        query = query.order('data_triagem', { ascending: false });

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        setTriagens(data as Triagem[] || []);
        logger.info('Triagens buscadas com sucesso');
        return { success: true, data: data as Triagem[] };
      } catch (err) {
        const handledError = handleError(err, 'useTriagens.buscarTriagens');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [pacienteId]
  );

  /**
   * Criar nova triagem
   */
  const criar = useCallback(
    async (dados: Omit<Triagem, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; data?: Triagem; error?: HandledError }> => {
      try {
        setLoading(true);

        const { data, error: createError } = await supabase
          .from('triagens')
          .insert([dados])
          .select()
          .single();

        if (createError) throw createError;

        setTriagens([data as Triagem, ...triagens]);
        logger.info('Triagem criada com sucesso');
        return { success: true, data: data as Triagem };
      } catch (err) {
        const handledError = handleError(err, 'useTriagens.criar');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [triagens]
  );

  /**
   * Atualizar triagem
   */
  const atualizar = useCallback(
    async (id: string, dados: Partial<Triagem>): Promise<{ success: boolean; data?: Triagem; error?: HandledError }> => {
      try {
        setLoading(true);

        const { data, error: updateError } = await supabase
          .from('triagens')
          .update(dados)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw updateError;

        setTriagens(triagens.map((t) => (t.id === id ? (data as Triagem) : t)));
        logger.info('Triagem atualizada com sucesso');
        return { success: true, data: data as Triagem };
      } catch (err) {
        const handledError = handleError(err, 'useTriagens.atualizar');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    [triagens]
  );

  return {
    triagens,
    loading,
    error,
    buscarTriagens,
    criar,
    atualizar,
  };
};

export default useTriagens;
