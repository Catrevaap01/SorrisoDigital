/**
 * Lógica de negócio para triagens/pacientes/dentistas
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';
import { uploadImage, uploadMultipleImages, deleteImage } from './storageService';
import { notificarTriagemEnviada, gerarFeedbackAutomatico, enviarFeedbackPaciente } from './notificacoesService';

export interface TriagemData {
  paciente_id?: string;
  dentista_id?: string;
  sintoma_principal?: string;
  descricao?: string;
  duracao?: string;
  localizacao?: string;
  intensidade_dor?: number;
  imagens?: string[];
  prioridade?: string;
  status?: string;
  data_agendamento?: string;
  observacoes?: string;
  [key: string]: any;
}

export interface Triagem extends TriagemData {
  id: string;
  created_at?: string;
  updated_at?: string;
  paciente?: Record<string, any>;
  respostas?: any[];
}

export interface Contadores {
  pendente: number;
  urgente: number;
  respondido: number;
  total: number;
  [key: string]: number;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: HandledError | string;
}

/**
 * Cria uma nova triagem (paciente)
 * opcionalmente envia imagens antes de inserir o registro
 * Notifica dentistas e envia feedback automático para o paciente
 */
export const criarTriagem = async (
  dados: Partial<TriagemData>,
  imageUris: string[] = [],
  pacienteId?: string
): Promise<ServiceResult<Triagem>> => {
  try {
    // fazer upload das imagens primeiro
    if (imageUris.length && pacienteId) {
      const urls = await uploadMultipleImages(imageUris, pacienteId);
      dados.imagens = urls;
    }

    const { data, error } = await supabase
      .from('triagens')
      .insert([dados])
      .select()
      .single();

    if (error) throw error;

    const triagem = data as Triagem;

    // Buscar dados do paciente para notificação
    if (pacienteId) {
      const { data: paciente } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', pacienteId)
        .single();

      if (paciente) {
        // 1. Notificar dentistas da nova triagem
        await notificarTriagemEnviada(
          pacienteId,
          paciente.nome || 'Paciente',
          triagem.id,
          dados.sintomaPrincipal || 'Sintoma não informado'
        );

        // 2. Gerar e enviar feedback automático para o paciente
        const feedback = gerarFeedbackAutomatico(
          dados.sintomaPrincipal || '',
          dados.intensidade_dor || 0,
          dados.duracao || ''
        );

        await enviarFeedbackPaciente(pacienteId, feedback, triagem.id);
      }
    }

    return { success: true, data: triagem };
  } catch (err) {
    const handled = handleError(err, 'triagemService.criarTriagem');
    return { success: false, error: handled };
  }
};

export const buscarTriagensPaciente = async (
  pacienteId: string
): Promise<ServiceResult<Triagem[]>> => {
  try {
    const { data, error } = await supabase
      .from('triagens')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as Triagem[] };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarTriagensPaciente');
    return { success: false, error: handled };
  }
};

export const buscarTodasTriagens = async (
  filtros: { status?: string | null } = {}
): Promise<ServiceResult<Triagem[]>> => {
  try {
    let query = supabase.from('triagens').select('*');
    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return { success: true, data: data as Triagem[] };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarTodasTriagens');
    return { success: false, error: handled };
  }
};

export const buscarContadores = async (): Promise<ServiceResult<Contadores>> => {
  try {
    const { data, error } = await supabase.rpc('contar_triagens');
    // supabase rpc must be defined in DB; fallback to manual count if not
    if (error) throw error;

    return { success: true, data: (data as any) as Contadores };
  } catch (err) {
    // se rpc não existir, obter manualmente
    try {
      const { data: all, error: e1 } = await supabase
        .from('triagens')
        .select('status');
      if (e1) throw e1;
      const cont: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0 };
      (all as Array<any>).forEach((t) => {
        cont.total += 1;
        if (t.status in cont) cont[t.status] += 1;
      });
      return { success: true, data: cont };
    } catch (e2) {
      const handled = handleError(e2, 'triagemService.buscarContadores');
      return { success: false, error: handled };
    }
  }
};

export const buscarTriagemPorId = async (
  id: string
): Promise<ServiceResult<Triagem>> => {
  try {
    const { data, error } = await supabase
      .from('triagens')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { success: true, data: data as Triagem };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarTriagemPorId');
    return { success: false, error: handled };
  }
};

export const responderTriagem = async (
  triagemId: string,
  dentistaId: string,
  resposta: { orientacao: string; recomendacao: string; observacoes?: string }
): Promise<ServiceResult<null>> => {
  try {
    // 1. Inserir resposta na triagem
    const { data, error } = await supabase
      .from('respostas_triagem')
      .insert([
        {
          triagem_id: triagemId,
          dentista_id: dentistaId,
          ...resposta,
        },
      ]);

    if (error) throw error;

    // 2. Atualizar status da triagem para respondida
    await supabase
      .from('triagens')
      .update({ status: 'respondido' })
      .eq('id', triagemId);

    // 3. Buscar dados para notificar o paciente
    const { data: triagem } = await supabase
      .from('triagens')
      .select('paciente_id')
      .eq('id', triagemId)
      .single();

    const { data: dentista } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', dentistaId)
      .single();

    if (triagem && dentista) {
      const { notificarTriagemRespondida } = await import('./notificacoesService');
      await notificarTriagemRespondida(
        triagem.paciente_id,
        dentista.nome || 'Dentista',
        triagemId,
        resposta.orientacao
      );
    }

    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'triagemService.responderTriagem');
    return { success: false, error: handled };
  }
};

export const atualizarStatusTriagem = async (
  triagemId: string,
  status: string,
  prioridade?: string
): Promise<ServiceResult<null>> => {
  try {
    const upd: any = { status };
    if (prioridade) upd.prioridade = prioridade;
    const { error } = await supabase
      .from('triagens')
      .update(upd)
      .eq('id', triagemId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'triagemService.atualizarStatusTriagem');
    return { success: false, error: handled };
  }
};
