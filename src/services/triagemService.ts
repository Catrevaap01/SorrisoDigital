/**

 * Lógica de negócio para triagens/pacientes/dentistas
 */

import { Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';
import { withTimeout } from '../utils/withTimeout';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';
import { uploadMultipleImages } from './storageService';
import { enqueueOfflineAction } from './offlineSyncService';
import { obterOuCriarConversa, enviarMensagem } from './messagesService';

const extra = Constants.expoConfig?.extra;
const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const getAdminClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

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
  realizados: number;
  [key: string]: number;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string | import('../utils/errorHandler').HandledError;
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

  // PARALLEL: All enrichment queries with Promise.allSettled (web perf fix)
  const enrichmentPromises = [];
  if (pacienteIds.length) {
    enrichmentPromises.push(withTimeout(supabase
      .from('profiles')
      .select('id, nome, email, telefone, provincia_id, historico_medico, alergias, medicamentos_atuais')
      .limit(50)
      .in('id', pacienteIds) as any, 5000));
  } else {
    enrichmentPromises.push(Promise.resolve({ data: [] }));
  }

  if (triagemIds.length) {
    enrichmentPromises.push(withTimeout(supabase
      .from('respostas_triagem')
      .select('*')
      .limit(100)
      .in('triagem_id', triagemIds)
      .order('created_at', { ascending: false }) as any, 5000));
  } else {
    enrichmentPromises.push(Promise.resolve({ data: [] }));
  }

  if (pacienteIds.length) {
    enrichmentPromises.push(withTimeout(supabase
      .from('agendamentos')
      .select('*')
      .limit(50)
      .in('paciente_id', pacienteIds)
      .order('data_agendamento', { ascending: false }) as any, 5000));
  } else {
    enrichmentPromises.push(Promise.resolve({ data: [] }));
  }

  const startTime = Date.now();
  const [pacientesPromise, respostasPromise, agendamentosPromise] = await Promise.allSettled(enrichmentPromises);
  const endTime = Date.now();
  if (endTime - startTime > 1500) {
    console.warn(`⚠️ enrichTriagens: Consultas demoraram ${endTime - startTime}ms`);
  }

  let pacientesById: Record<string, any> = {};
  if (pacientesPromise.status === 'fulfilled') {
    const result = pacientesPromise.value as {data: any[], error?: any};
    if (result.data) {
      const pacientes = result.data;
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
  }

  let respostasByTriagemId: Record<string, any[]> = {};
  if (respostasPromise.status === 'fulfilled' && respostasPromise.value.data) {
    const respostas = respostasPromise.value.data;
    // Parallel dentistas fetch inside respostas
    const dentistaIds = Array.from(
      new Set((respostas || []).map((r: any) => r.dentista_id).filter(Boolean))
    ) as string[];

    const dentistasQuery = supabase
      .from('profiles')
      .select('id, nome, email, telefone')
      .limit(Platform.OS === 'web' ? 20 : 50)
      .in('id', dentistaIds);
    
    const dentistasResult = dentistaIds.length ? await withTimeout(dentistasQuery, 5000) : { data: [] as any[], error: null };
    if (dentistasResult.error) logger.warn('enrichTriagens: dentistas query failed', dentistasResult.error);

    const dentistasById = Object.fromEntries((dentistasResult.data || []).map((d: any) => [d.id, d]));

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
  if (agendamentosPromise.status === 'fulfilled' && agendamentosPromise.value.data) {
    const agendamentos = agendamentosPromise.value.data;
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

  // Graceful fallback: log failures but continue
  if (pacientesPromise.status === 'rejected') logger.warn('enrichTriagens: pacientes failed', pacientesPromise.reason);
  if (respostasPromise.status === 'rejected') logger.warn('enrichTriagens: respostas failed', respostasPromise.reason);
  if (agendamentosPromise.status === 'rejected') logger.warn('enrichTriagens: agendamentos failed', agendamentosPromise.reason);

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
    if (typeof window !== 'undefined' && !navigator.onLine) {
      await enqueueOfflineAction({
        type: 'criarTriagem',
        payload: {
          dados,
          imageUris,
          pacienteId,
        },
        endpoint: '/api/sync/criarTriagem',
        method: 'POST',
      });

      return {
        success: false,
        error:
          'Sem internet: triagem salva localmente e será sincronizada automaticamente quando online.',
      };
    }

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
    const { data, error } = await withTimeout(supabase
      .from('triagens')
      .select('*')
      .limit(50)
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false }) as any, 6000);

    if (error) {
      console.error('❌ buscarTriagensPaciente error:', error);
      throw error;
    }
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
    const { data, error } = await withTimeout(supabase
      .from('triagens')
      .select('*')
      .limit(50)
      .eq('dentista_id', dentistaId)
      .order('created_at', { ascending: false }) as any, 6000);

    if (error) {
      console.error('❌ buscarTriagensDentista error:', error);
      throw error;
    }
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
    // Executa as 3 consultas principais em paralelo para máxima velocidade
    const [triagensRes, repliesRes, agendamentosRes] = await Promise.all([
      supabase.from('triagens').select('id, status, prioridade').eq('dentista_id', dentistaId),
      supabase.from('respostas_triagem').select('triagem_id').eq('dentista_id', dentistaId),
      supabase.from('agendamentos').select('id, status').eq('dentista_id', dentistaId).eq('status', 'realizado')
    ]);

    if (triagensRes.error) throw triagensRes.error;
    
    const cont: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0, realizados: 0 };
    const statusById: Record<string, string> = {};
    const priorityById: Record<string, string> = {};
    const respondedIdsInContadores = new Set<string>();

    (triagensRes.data || []).forEach((t: any) => {
      cont.total += 1;
      statusById[t.id] = t.status;
      priorityById[t.id] = t.prioridade;
      
      const isRespondido = t.status === 'respondido' || t.status === 'completo';
      if (isRespondido) {
        cont.respondido += 1;
        respondedIdsInContadores.add(t.id);
      } else {
        const isUrgente = t.status === 'urgente' || t.prioridade === 'urgente' || t.prioridade === 'alta';
        if (isUrgente) {
          cont.urgente += 1;
        }
        if (t.status === 'pendente') {
          cont.pendente += 1;
        }
      }
    });

    if (!repliesRes.error && repliesRes.data) {
      const respondedViaReplies = new Set<string>((repliesRes.data || []).map((r: any) => r.triagem_id));
      respondedViaReplies.forEach((id) => {
        // Se ainda não contamos como respondido pelo status, mas tem resposta, contamos agora
        if (!respondedIdsInContadores.has(id)) {
          const status = statusById[id];
          const prio = priorityById[id];
          if (status) {
            // Se era pendente ou urgente, decrementamos o contador original
            if (status === 'pendente') {
              cont.pendente = Math.max(0, cont.pendente - 1);
            }
            const isUrgente = status === 'urgente' || prio === 'urgente' || prio === 'alta';
            if (isUrgente) {
              cont.urgente = Math.max(0, cont.urgente - 1);
            }
            cont.respondido += 1;
            respondedIdsInContadores.add(id);
          }
        }
      });
    }

    if (!agendamentosRes.error && agendamentosRes.data) {
      cont.realizados = agendamentosRes.data.length;
    }

    // Nota: O contador no frontend agora engloba triagens e agendamentos.
    // Para simplificar, o contador de total ja inclui as triagens. 
    // Os agendamentos que estao 'respondidos' (via triagem) sao filtrados no UI.
    // Para manter a consistencia, garantimos que o respondido represente triagens unicas respondidas.
    
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
      const cont: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0, realizados: 0 };
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
  resposta: { orientacao: string; recomendacao: string; observacoes?: string },
  extras: { pacienteId: string; dentistaNome: string; dentistaAvatar: string | null }
): Promise<ServiceResult<null>> => {
  try {
    console.log('📝 Inserindo resposta...', { triagemId, dentistaId });
    
    const adminClient = getAdminClient();
    
    const runInsert = async (payload: Record<string, any>) => {
      // Try regular client first
      console.log('📡 Tentando insert com cliente comum...');
      let res = await supabase
        .from('respostas_triagem')
        .insert(payload)
        .select()
        .single();
      
      // If RLS error (42501) or other permission issue, try admin client as fallback
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403 || (res.error as any).status === 401)) {
        if (adminClient) {
          console.warn('⚠️ RLS capturado ou erro de permissão. Tentando com ADMIN client...');
          res = await adminClient
            .from('respostas_triagem')
            .insert(payload)
            .select()
            .single();
        }
      }
      return res;
    };
    let insertPayload: Record<string, any> = {
      triagem_id: triagemId,
      dentista_id: dentistaId,
      ...resposta,
    };

    let { data: insertData, error: insertError } = await runInsert(insertPayload);

    // retry loop for missing-column errors in respostas_triagem
    while (insertError && (insertError as any).code === 'PGRST204') {
      const missingColumnMatch = (insertError as any).message?.match(/'([^']+)' column/);
      const missingColumn = missingColumnMatch?.[1];

      if (!missingColumn || !(missingColumn in insertPayload)) break;

      console.warn(`⚠️ Coluna ausente em respostas_triagem ignorada: ${missingColumn}`);
      const { [missingColumn]: _, ...nextPayload } = insertPayload;
      insertPayload = nextPayload;
      ({ data: insertData, error: insertError } = await runInsert(insertPayload));
    }

    if (insertError) {
      console.error('❌ Erro no Insert da Resposta:', insertError);
      throw insertError;
    }
    console.log('✅ Resposta inserida com sucesso.');

    // após responder, atualiza o status da triagem para respondido e vincula ao dentista
    const client = adminClient || supabase;
    console.log(`🔄 Atualizando status da triagem (${adminClient ? 'ADMIN' : 'USER'} client)...`);
    
    const runUpdate = async (updPayload: Record<string, any>) =>
      await client
        .from('triagens')
        .update(updPayload)
        .eq('id', triagemId);

    let updatePayload: Record<string, any> = { 
      status: 'respondido', 
      dentista_id: dentistaId,
      updated_at: new Date().toISOString() 
    };

    let { error: updateError } = await runUpdate(updatePayload);

    // retry loop for missing-column errors in triagens update
    while (updateError && (updateError as any).code === 'PGRST204') {
      const missingColumnMatch = (updateError as any).message?.match(/'([^']+)' column/);
      const missingColumn = missingColumnMatch?.[1];

      if (!missingColumn || !(missingColumn in updatePayload)) break;

      console.warn(`⚠️ Coluna ausente em triagens durante update ignorada: ${missingColumn}`);
      const { [missingColumn]: _, ...nextUpdPayload } = updatePayload;
      updatePayload = nextUpdPayload;
      ({ error: updateError } = await runUpdate(updatePayload));
    }
    
    if (updateError) {
      console.error('❌ Erro no Update do Status:', updateError);
      logger.error('Erro ao atualizar status da triagem apos resposta', updateError);
      return { success: false, error: `Resposta salva, mas erro no status: ${updateError.message}` };
    }
    console.log('✅ Status da triagem atualizado para respondido.');
    
    // Enviar mensagem automática para disparar notificação real-time no Web/Mobile
    try {
      console.log('💬 Criando conversa e enviando mensagem de notificação...');
      const conversaResult = await obterOuCriarConversa(
        dentistaId, 
        extras.pacienteId,
        extras.dentistaNome,
        '', // paciente_name (vazio pois o service busca se necessário)
        extras.dentistaAvatar
      );

      if (conversaResult.success && conversaResult.data) {
        await enviarMensagem(
          conversaResult.data.id,
          dentistaId,
          extras.dentistaNome,
          extras.dentistaAvatar,
          `Olá! Acabei de analisar sua triagem. Você pode conferir minhas orientações no seu histórico.`
        );
        console.log('✅ Mensagem de notificação enviada.');
      }
    } catch (msgErr) {
      console.warn('⚠️ Erro ao enviar mensagem de notificação (não crítico):', msgErr);
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
    const adminClient = getAdminClient();
    const client = adminClient || supabase;

    const runUpdate = async (updPayload: Record<string, any>) =>
      await client
        .from('triagens')
        .update(updPayload)
        .eq('id', triagemId);

    let updatePayload: any = { 
      status, 
      updated_at: new Date().toISOString() 
    };
    if (prioridade) updatePayload.prioridade = prioridade;

    let { error } = await runUpdate(updatePayload);

    while (error && (error as any).code === 'PGRST204') {
      const missingColumnMatch = (error as any).message?.match(/'([^']+)' column/);
      const missingColumn = missingColumnMatch?.[1];

      if (!missingColumn || !(missingColumn in updatePayload)) break;

      const { [missingColumn]: _, ...nextPayload } = updatePayload;
      updatePayload = nextPayload;
      ({ error } = await runUpdate(updatePayload));
    }

    if (error) throw error;
    return { success: true };
  } catch (err) {
    const handled = handleError(err, 'triagemService.atualizarStatusTriagem');
    return { success: false, error: handled };
  }
};
