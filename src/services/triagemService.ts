/**
 * Lógica de negócio para triagens/pacientes/dentistas
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';
import { uploadMultipleImages } from './storageService';
import { obterOuCriarConversa } from './messagesService';

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
  agendamentos?: any[];
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

const TRIAGEM_CAMEL_TO_SNAKE: Record<string, string> = {
  pacienteId: 'paciente_id',
  dentistaId: 'dentista_id',
  sintomaPrincipal: 'sintoma_principal',
  intensidadeDor: 'intensidade_dor',
  dataAgendamento: 'data_agendamento',
};

const toTriagemDbPayload = (
  dados: Partial<TriagemData>,
  pacienteId?: string
): Record<string, any> => {
  const payload: Record<string, any> = {};

  Object.entries(dados || {}).forEach(([key, value]) => {
    const mappedKey = TRIAGEM_CAMEL_TO_SNAKE[key] || key;
    payload[mappedKey] = value;
  });

  if (pacienteId && !payload.paciente_id) {
    payload.paciente_id = pacienteId;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
};

const normalizeTriagemRecord = (row: any): Triagem => {
  if (!row) return row as Triagem;
  return {
    ...row,
    sintoma_principal: row.sintoma_principal ?? row.sintomaPrincipal,
    intensidade_dor: row.intensidade_dor ?? row.intensidadeDor,
    data_agendamento: row.data_agendamento ?? row.dataAgendamento,
  } as Triagem;
};

const PROVINCIAS_STATIC_ORDER = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huila',
  'Bie',
  'Malanje',
  'Uige',
  'Zaire',
  'Cabinda',
  'Cunene',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Namibe',
  'Bengo',
];

const provinciaNameFromId = (id?: number): string | undefined => {
  if (!id || id < 1 || id > PROVINCIAS_STATIC_ORDER.length) return undefined;
  return PROVINCIAS_STATIC_ORDER[id - 1];
};

const enrichTriagens = async (triagensBase: Triagem[]): Promise<Triagem[]> => {
  if (!triagensBase.length) return triagensBase;

  const triagens = triagensBase.map((t) => ({ ...t }));
  const triagemIds = triagens.map((t) => t.id).filter(Boolean);
  const pacienteIds = Array.from(
    new Set(triagens.map((t) => t.paciente_id).filter(Boolean))
  ) as string[];

  let pacientesById: Record<string, any> = {};
  if (pacienteIds.length) {
    const { data: pacientes } = await supabase
      .from('profiles')
      .select('id, nome, email, telefone, provincia_id, data_nascimento, genero, historico_medico, alergias, medicamentos_atuais, provincias(nome)')
      .in('id', pacienteIds);

    pacientesById = Object.fromEntries(
      (pacientes || []).map((p: any) => [
        p.id,
        {
          ...p,
          provincia:
            p.provincia ??
            p.provincias?.nome ??
            p.provincias?.[0]?.nome ??
            provinciaNameFromId(p.provincia_id),
        },
      ])
    );
  }

  let respostasByTriagemId: Record<string, any[]> = {};
  if (triagemIds.length) {
    const { data: respostas } = await supabase
      .from('respostas_triagem')
      .select('*')
      .in('triagem_id', triagemIds)
      .order('created_at', { ascending: false });

    const dentistaIds = Array.from(
      new Set((respostas || []).map((r: any) => r.dentista_id).filter(Boolean))
    ) as string[];

    let dentistasById: Record<string, any> = {};
    if (dentistaIds.length) {
      const { data: dentistas } = await supabase
        .from('profiles')
        .select('id, nome, email, telefone')
        .in('id', dentistaIds);

      dentistasById = Object.fromEntries((dentistas || []).map((d: any) => [d.id, d]));
    }

    respostasByTriagemId = (respostas || []).reduce((acc: Record<string, any[]>, r: any) => {
      const triagemId = r.triagem_id;
      if (!acc[triagemId]) acc[triagemId] = [];
      acc[triagemId].push({
        ...r,
        dentista: r.dentista || dentistasById[r.dentista_id] || undefined,
      });
      return acc;
    }, {});
  }

  let agendamentosByPacienteId: Record<string, any[]> = {};
  if (pacienteIds.length) {
    const { data: agendamentos } = await supabase
      .from('agendamentos')
      .select('*')
      .in('paciente_id', pacienteIds)
      .order('data_agendamento', { ascending: false });

    agendamentosByPacienteId = (agendamentos || []).reduce(
      (acc: Record<string, any[]>, ag: any) => {
        const pacienteId = ag.paciente_id;
        if (!acc[pacienteId]) acc[pacienteId] = [];
        acc[pacienteId].push(ag);
        return acc;
      },
      {}
    );
  }

  return triagens.map((t) => ({
    ...t,
    paciente: t.paciente || pacientesById[t.paciente_id || ''] || undefined,
    respostas: t.respostas || respostasByTriagemId[t.id] || [],
    agendamentos: agendamentosByPacienteId[t.paciente_id || ''] || [],
  }));
};

/**
 * Cria uma nova triagem (paciente)
 * opcionalmente envia imagens antes de inserir o registro
 */
export const criarTriagem = async (
  dados: Partial<TriagemData>,
  imageUris: string[] = [],
  pacienteId?: string
): Promise<ServiceResult<Triagem>> => {
  try {
    const payload = toTriagemDbPayload(dados, pacienteId);

    // fazer upload das imagens primeiro
    if (imageUris.length && pacienteId) {
      const urls = await uploadMultipleImages(imageUris, pacienteId);
      if (urls.length > 0) {
        payload.imagens = urls;
      } else {
        logger.warn(
          'Upload de imagens indisponivel (bucket/politica). Triagem sera criada sem imagens.'
        );
      }
    }

    const runInsert = async (insertPayload: Record<string, any>) =>
      await supabase
        .from('triagens')
        .insert([insertPayload])
        .select()
        .single();

    let currentPayload = { ...payload };
    let { data, error } = await runInsert(currentPayload);

    while (error && (error as any).code === 'PGRST204') {
      const missingColumnMatch = (error as any).message?.match(/'([^']+)' column/);
      const missingColumn = missingColumnMatch?.[1];

      if (!missingColumn || !(missingColumn in currentPayload)) {
        break;
      }

      const { [missingColumn]: _, ...fallbackPayload } = currentPayload;
      currentPayload = fallbackPayload;
      ({ data, error } = await runInsert(currentPayload));

      if (!error) {
        logger.warn(
          `Coluna ausente no schema de triagens ignorada no criarTriagem: ${missingColumn}`
        );
      }
    }

    if (error) throw error;

    // trigger chat creation if dentist was specified
    try {
      const created: Triagem = normalizeTriagemRecord(data);
      if (created.dentista_id && pacienteId) {
        // procura nomes e avatares para evitar conversas sem identificação
        const [{ data: paciente }, { data: dentista }] = await Promise.all([
          supabase
            .from('profiles')
            .select('nome, foto_url')
            .eq('id', pacienteId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('nome, foto_url')
            .eq('id', created.dentista_id)
            .maybeSingle(),
        ]);

        await obterOuCriarConversa(
          pacienteId,
          created.dentista_id,
          paciente?.nome || undefined,
          dentista?.nome || undefined,
          paciente?.foto_url || null,
          dentista?.foto_url || null
        );
      }
    } catch (chatErr) {
      logger.warn('Falha ao criar conversa automática para triagem', chatErr);
    }

    return { success: true, data: normalizeTriagemRecord(data) };
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
    const normalized = (data || []).map((item) => normalizeTriagemRecord(item));
    return { success: true, data: await enrichTriagens(normalized) };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarTriagensPaciente');
    return { success: false, error: handled };
  }
};

export const buscarTriagensDentista = async (
  dentistaId: string
): Promise<ServiceResult<Triagem[]>> => {
  try {
    const { data, error } = await supabase
      .from('triagens')
      .select('*')
      .eq('dentista_id', dentistaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const normalized = (data || []).map((item) => normalizeTriagemRecord(item));
    return { success: true, data: await enrichTriagens(normalized) };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarTriagensDentista');
    return { success: false, error: handled };
  }
};

// returns only status counts for a specific dentist (no enrichment)
export const buscarContadoresDentista = async (
  dentistaId: string
): Promise<ServiceResult<Contadores>> => {
  try {
    const { data, error } = await supabase
      .from('triagens')
      .select('id, status, prioridade')
      .eq('dentista_id', dentistaId);

    if (error) throw error;
    const cont: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0 };
    const statusById: Record<string, string> = {};
    const priorityById: Record<string, string> = {};

    (data || []).forEach((t: any) => {
      cont.total += 1;
      statusById[t.id] = t.status;
      priorityById[t.id] = t.prioridade;
      // urgent may come from status or priority
      if (t.status === 'pendente') cont.pendente += 1;
      if (
        t.status === 'urgente' ||
        t.prioridade === 'urgente' ||
        t.prioridade === 'alta'
      )
        cont.urgente += 1;
      if (t.status === 'respondido' || t.status === 'completo') cont.respondido += 1;
      // note: one triagem may increment multiple counters if both urgent and responded, but
      // UI filters will handle priorities separately.
    });

    // additionally, if there are replies recorded but status wasn't updated, count them as responded
    const { data: replies, error: replyErr } = await supabase
      .from('respostas_triagem')
      .select('triagem_id')
      .eq('dentista_id', dentistaId);
    if (!replyErr && replies) {
      const respondedIds = new Set<string>((replies || []).map((r: any) => r.triagem_id));
      respondedIds.forEach((id) => {
        const status = statusById[id];
        const prio = priorityById[id];
        if (status && status !== 'respondido' && status !== 'completo') {
          // adjust counters: remove from pendente and urgent if necessary
          if (status === 'pendente') cont.pendente = Math.max(0, cont.pendente - 1);
          if (
            status === 'urgente' ||
            prio === 'urgente' ||
            prio === 'alta'
          ) {
            cont.urgente = Math.max(0, cont.urgente - 1);
          }
          cont.respondido += 1;
        }
      });
    }

    return { success: true, data: cont };
  } catch (err) {
    const handled = handleError(err, 'triagemService.buscarContadoresDentista');
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
    const normalized = (data || []).map((item) => normalizeTriagemRecord(item));
    return { success: true, data: await enrichTriagens(normalized) };
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
    const normalized = normalizeTriagemRecord(data);
    const enriched = await enrichTriagens([normalized]);
    return { success: true, data: enriched[0] };
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

    // após responder, atualiza o status da triagem para responded
    await supabase
      .from('triagens')
      .update({ status: 'respondido', updated_at: new Date().toISOString() })
      .eq('id', triagemId);

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
