/**
 * Serviço para conteúdos educacionais
 */

import { supabase } from '../config/supabase';
import { HandledError, handleError } from '../utils/errorHandler';

export interface Conteudo {
  id: string;
  titulo: string;
  descricao?: string;
  categoria?: string;
  conteudo?: string;
  imagem_url?: string;
  ativo: boolean;
  data_criacao?: string;
  visualizacoes?: number;
  ordem?: number;
  [key: string]: any;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const buscarConteudos = async (
  categoria: string | null = null
): Promise<ServiceResult<Conteudo[]>> => {
  try {
    let query = supabase
      .from('conteudos_educativos')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (categoria && categoria !== 'todos') {
      query = query.eq('categoria', categoria);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data as Conteudo[] };
  } catch (err) {
    const message = (err as any)?.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};

export const buscarConteudoPorId = async (
  id: string
): Promise<ServiceResult<Conteudo>> => {
  try {
    const { data, error } = await supabase
      .from('conteudos_educativos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    await supabase
      .from('conteudos_educativos')
      .update({ visualizacoes: (data.visualizacoes || 0) + 1 })
      .eq('id', id);

    return { success: true, data: data as Conteudo };
  } catch (err) {
    const message = (err as any)?.message || 'Erro desconhecido';
    return { success: false, error: message };
  }
};
