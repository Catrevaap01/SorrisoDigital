/**
 * Hook para gerenciar conteúdos educacionais
 * Encapsula lógica de busca de artigos e materiais
 */

import { useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

export interface Conteudo {
  id: string;
  titulo: string;
  descricao?: string;
  categoria?: string;
  conteudo?: string;
  imagem_url?: string;
  ativo: boolean;
  data_criacao?: string;
  [key: string]: any;
}

export interface UseConteudosResult {
  conteudos: Conteudo[];
  loading: boolean;
  error: HandledError | null;
  buscarConteudos: (filtros?: Record<string, any>) => Promise<{ success: boolean; data?: Conteudo[]; error?: HandledError }>;
  buscarPorId: (id: string) => Promise<{ success: boolean; data?: Conteudo; error?: HandledError }>;
  buscarPorCategoria: (categoria: string) => Promise<{ success: boolean; data?: Conteudo[]; error?: HandledError }>;
}

export const useConteudos = (): UseConteudosResult => {
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<HandledError | null>(null);

  /**
   * Buscar conteúdos educacionais
   */
  const buscarConteudos = useCallback(
    async (filtros: Record<string, any> = {}): Promise<{ success: boolean; data?: Conteudo[]; error?: HandledError }> => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('conteudos_educacionais')
          .select('*')
          .eq('ativo', true);

        Object.entries(filtros).forEach(([key, value]) => {
          if (value) {
            query = query.eq(key, value);
          }
        });

        query = query.order('data_criacao', { ascending: false });

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        setConteudos(data as Conteudo[] || []);
        logger.info('Conteúdos buscados com sucesso');
        return { success: true, data: data as Conteudo[] };
      } catch (err) {
        const handledError = handleError(err, 'useConteudos.buscarConteudos');
        setError(handledError);
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Buscar conteúdo por ID
   */
  const buscarPorId = useCallback(
    async (id: string): Promise<{ success: boolean; data?: Conteudo; error?: HandledError }> => {
      try {
        setLoading(true);

        const { data, error: queryError } = await supabase
          .from('conteudos_educacionais')
          .select('*')
          .eq('id', id)
          .single();

        if (queryError) throw queryError;

        logger.info('Conteúdo buscado com sucesso');
        return { success: true, data: data as Conteudo };
      } catch (err) {
        const handledError = handleError(err, 'useConteudos.buscarPorId');
        return { success: false, error: handledError };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Buscar conteúdos por categoria
   */
  const buscarPorCategoria = useCallback(
    async (categoria: string): Promise<{ success: boolean; data?: Conteudo[]; error?: HandledError }> => {
      return buscarConteudos({ categoria });
    },
    [buscarConteudos]
  );

  return {
    conteudos,
    loading,
    error,
    buscarConteudos,
    buscarPorId,
    buscarPorCategoria,
  };
};

export default useConteudos;
