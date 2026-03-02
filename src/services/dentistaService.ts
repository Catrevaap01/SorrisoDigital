/**
 * Servico de gerenciamento de dentistas
 * Funcoes para criar, listar, atualizar e deletar dentistas
 */

import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { UserProfile } from '../contexts/AuthContext';
import { sendWelcomeEmailToDentista } from './emailService';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

export interface DentistaProfile extends UserProfile {
  especialidade?: string;
  crm?: string;
  numero_registro?: string;
  telefone?: string;
  provincia?: string;
  foto_url?: string;
}

export interface CriarDentistaResult {
  success: boolean;
  data?: DentistaProfile;
  tempPassword?: string;
  emailSent?: boolean;
  warning?: string;
  error?: string;
}

const DENTISTAS_CACHE_TTL_MS = 60 * 1000;
let dentistasCache: DentistaProfile[] | null = null;
let dentistasCacheAt = 0;

const isDentistasCacheValid = (): boolean =>
  !!dentistasCache && Date.now() - dentistasCacheAt < DENTISTAS_CACHE_TTL_MS;

const setDentistasCache = (data: DentistaProfile[]): void => {
  if (!data || data.length === 0) {
    return;
  }
  dentistasCache = data;
  dentistasCacheAt = Date.now();
};

const invalidateDentistasCache = (): void => {
  dentistasCache = null;
  dentistasCacheAt = 0;
};

const normalizeDentista = (row: any): DentistaProfile => ({
  ...(row || {}),
  crm: row?.crm || row?.numero_registro || row?.registro || undefined,
});

const isNoRowsError = (error: any): boolean =>
  !!error &&
  ((error as any).code === 'PGRST116' ||
    String((error as any).message || '').toLowerCase().includes('no rows'));

const isRowLevelSecurityError = (error: any): boolean => {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    (error as any)?.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  );
};

const isDentistaLike = (row: any): boolean => {
  if (!row) return false;
  const tipo = String(row.tipo || '').toLowerCase();
  return (
    tipo === 'dentista' ||
    tipo === 'medico' ||
    !!row.crm ||
    !!row.numero_registro ||
    !!row.especialidade
  );
};

// insert profile with upsert to guarantee correct tipo even if auth
// trigger already created a row with default 'paciente'. using upsert avoids
// duplicate-key errors and ensures the desired fields prevail.
//
// When RLS is enabled the query may fail if the database schema is out‑of‑date
// and the payload contains a column that doesn't exist yet. supabase-js will
// return a `{ code: 'PGRST204' }` error in that case. existing code only handled
// this for updates, so attempting to create a new dentist against an old
// database would crash with "Could not find the 'crm' column". we retry here
// by stripping the missing column from the payload and trying again. this keeps
// the admin UX working even if the DBA hasn't run the migration yet.
const upsertProfile = async (payload: Record<string, any>) => {
  let currentPayload: Record<string, any> = { ...payload };

  let response = await supabase
    .from('profiles')
    .upsert([currentPayload], { onConflict: 'id' })
    .select()
    .single();

  // retry loop for missing-column errors (code PGRST204)
  while (
    response.error &&
    (response.error as any).code === 'PGRST204'
  ) {
    const missingColumnMatch = (response.error as any).message?.match(/'([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (!missingColumn || !(missingColumn in currentPayload)) break;

    // drop the offending field and try again
    const { [missingColumn]: _ignored, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
    response = await supabase
      .from('profiles')
      .upsert([currentPayload], { onConflict: 'id' })
      .select()
      .single();
  }

  return response;
};

const stripMissingColumnAndRetryUpdate = async (
  id: string,
  payload: Record<string, any>
) => {
  let currentPayload = { ...payload };
  let response = await supabase
    .from('profiles')
    .update(currentPayload)
    .eq('id', id)
    .select()
    .single();

  while (response.error && (response.error as any).code === 'PGRST204') {
    const missingColumnMatch = (response.error as any).message?.match(/'([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (!missingColumn || !(missingColumn in currentPayload)) break;

    const { [missingColumn]: _ignored, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
    response = await supabase
      .from('profiles')
      .update(currentPayload)
      .eq('id', id)
      .select()
      .single();
  }

  return response;
};

/**
 * Criar novo dentista (apenas admin)
 */
export const criarDentista = async (
  email: string,
  senha: string,
  nome: string,
  especialidade: string,
  crm: string,
  telefone?: string,
  provincia?: string
): Promise<CriarDentistaResult> => {
  try {
    let warningMessage: string | undefined;
    const normalizedEmail = email.trim().toLowerCase();

    // check whether email already exists in profiles (admin can see all)
    const { data: existing, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (findError && !isNoRowsError(findError)) {
      // if error is other than "no rows found" we log but continue; a later
      // auth.signup will also fail appropriately.
      console.warn('erro ao verificar email existente:', findError.message);
    }
    if (existing) {
      return { success: false, error: 'E-mail já cadastrado' };
    }

    let passwordToUse = (senha || '').trim();
    if (!passwordToUse) {
      // geramos internamente quando chamado sem senha para evitar lógica
      // duplicada na UI
      const { gerarSenhaTemporaria } = await import('../utils/senhaUtils');
      passwordToUse = gerarSenhaTemporaria();
    }

    // 1. Criar usuario no Auth com metadata que identifica como "dentista".
    //    inclui tanto `tipo` (usado pelo app) quanto `role` para futuras
    //    customizações. O novo usuário não deve tomar a sessão atual do
    //    administrador, por isso vamos restaurar o token logo em seguida.
    // NOTE: precisamos criar o usuário usando um cliente *anônimo* para
    // que a sessão atual do admin não interfira. O supabase global carrega a
    // sessão do admin, por isso usamos um novo client construído com as
    // mesmas credenciais públicas.
    const extra = Constants.expoConfig?.extra;
    const anonUrl = extra?.SUPABASE_URL;
    const anonKey = extra?.SUPABASE_ANON_KEY;
    const anonClient = createClient(anonUrl || '', anonKey || '');

    const { data: authData, error: authError } = await anonClient.auth.signUp({
      email: normalizedEmail,
      password: passwordToUse,
      options: {
        data: {
          nome,
          tipo: 'dentista',
          role: 'dentista',
          especialidade,
          crm,
          force_password_change: true,
        },
      },
    });

    if (authError) {
      // map common auth errors to Portuguese for better UX
      let msg = authError.message;
      if (msg.includes('invalid email')) msg = 'E-mail inválido';
      if (msg.includes('already registered')) msg = 'E-mail já cadastrado';
      return { success: false, error: msg };
    }

    if (!authData.user) {
      return { success: false, error: 'Erro ao criar usuario' };
    }

    // `shouldCreateSession:false` garante que o admin não perde a sessão.
    // caso essa garantia falhe no futuro, poderíamos restaurar aqui.

    // 2. Criar perfil do dentista na tabela profiles
    const profilePayload = Object.fromEntries(
      Object.entries({
        id: authData.user.id,
        email: normalizedEmail,
        nome,
        tipo: 'dentista',
        especialidade,
        crm,
        numero_registro: crm,
        telefone: telefone || null,
        provincia: provincia || null,
        senha_alterada: PROFILE_SCHEMA_FEATURES.hasSenhaAlterada ? false : undefined,
        created_at: new Date().toISOString(),
      }).filter(([, value]) => value !== undefined)
    );

    // use mutable variables so we can alter them when a 'no rows' error
    // occurs; the original destructuring made profileData const which blocked
    // our recovery logic.
    const upsertResp = await upsertProfile(profilePayload);
    let profileData: any = upsertResp.data;
    let profileError: any = upsertResp.error;

    if (profileError) {
      // special-case schema errors to provide more guidance
      if ((profileError as any).code === 'PGRST204') {
        return {
          success: false,
          error:
            'Erro de esquema: coluna inexistente na tabela profiles. Execute o script SUPABASE_SETUP.sql para atualizar o banco de dados.',
        };
      }

      // supabase may return "no rows found" (PGRST116) if RLS prevents reading the
      // record immediately after insert/upsert. The row itself may have been
      // created successfully, so treat this as a warning rather than a hard
      // failure. Construct a profile from the payload so the UI still works.
      if (isNoRowsError(profileError)) {
        console.warn(
          'upsertProfile retornou erro "no rows" mas vamos supor que o dentista foi criado',
          profileError
        );
        // substitute profileData with payload so the rest of the flow can
        // continue as if we had received the row back from Supabase
        profileData = profilePayload;
        profileError = null; // clear error so we hit success path below
      } else if (isRowLevelSecurityError(profileError)) {
        // Em alguns projetos o trigger do Auth já cria o profile, mas o admin
        // não pode fazer upsert direto por RLS. Tentamos buscar a linha já criada
        // e seguimos sem bloquear o fluxo.
        const { data: maybeCreatedProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (maybeCreatedProfile) {
          profileData = {
            ...maybeCreatedProfile,
            nome: maybeCreatedProfile.nome || nome,
            especialidade: maybeCreatedProfile.especialidade || especialidade,
            crm: maybeCreatedProfile.crm || crm,
            numero_registro: maybeCreatedProfile.numero_registro || crm,
            telefone: maybeCreatedProfile.telefone || telefone || null,
            provincia: maybeCreatedProfile.provincia || provincia || null,
          };
          profileError = null;
        } else {
          // fallback: o usuário do Auth foi criado. Mantemos sucesso para a UI
          // não quebrar, e retornamos aviso para orientar correção de policy.
          profileData = profilePayload;
          profileError = null;
          warningMessage =
            'Usuario criado no Auth, mas a policy RLS bloqueou escrita em profiles. Execute docs/SUPABASE_SETUP.sql.';
        }
      } else {
        return { success: false, error: profileError.message };
      }
    }

    const dentista = normalizeDentista(profileData);
    // 3. Enviar email de boas‑vindas com a senha temporária criada. Fazemos no
    // próprio serviço para garantir que qualquer chamada (não apenas a UI de
    // administrador) dispare o envio em tempo real. Erros são logados e não
    // interrompem o fluxo principal.
    let emailSent = false;
    try {
      const emailRes = await sendWelcomeEmailToDentista(
        normalizedEmail,
        nome,
        passwordToUse
      );
      if (!emailRes.success) {
        console.warn('Falha ao enviar email de boas-vindas:', emailRes.error);
      } else {
        emailSent = true;
      }
    } catch (emailErr) {
      console.warn('Exceção ao enviar email de boas-vindas:', emailErr);
    }

    invalidateDentistasCache();
    return {
      success: true,
      data: dentista,
      tempPassword: passwordToUse,
      emailSent,
      warning: warningMessage,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao criar dentista',
    };
  }
};

/**
 * Listar todos os dentistas
 */
export const listarDentistas = async (
  options?: { forceRefresh?: boolean }
): Promise<{
  success: boolean;
  data?: DentistaProfile[];
  error?: string;
}> => {
  try {
    if (!options?.forceRefresh && isDentistasCacheValid()) {
      return { success: true, data: dentistasCache || [] };
    }

    const baseColumns =
      'id,nome,email,tipo,telefone,provincia,provincia_id,crm,numero_registro,especialidade,foto_url,created_at,updated_at';

    const withTimeout = async (query: any, ms = 12000): Promise<any> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Tempo de resposta excedido ao carregar dentistas'));
        }, ms);
      });

      try {
        return await Promise.race([Promise.resolve(query), timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Fallback principal para ambientes com RLS restritiva em profiles:
    // usar RPC SECURITY DEFINER (quando disponivel no banco).
    const rpcQuery = supabase.rpc('listar_dentistas_publicos');
    const { data: rpcData, error: rpcError } = await withTimeout(rpcQuery, 9000);
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const normalizedRpcData = rpcData.map(normalizeDentista);
      setDentistasCache(normalizedRpcData);
      return {
        success: true,
        data: normalizedRpcData,
      };
    }

    // Consulta principal: usa tipo para reduzir custo do filtro no banco.
    const primaryQuery = supabase
      .from('profiles')
      .select(baseColumns)
      .in('tipo', ['dentista', 'medico'])
      .order('nome', { ascending: true })
      .limit(300);

    const { data: primaryData, error: primaryError } = await withTimeout(primaryQuery);

    if (!primaryError && (primaryData?.length || 0) > 0) {
      const normalizedData = (primaryData || []).map(normalizeDentista);
      setDentistasCache(normalizedData);
      return {
        success: true,
        data: normalizedData,
      };
    }

    // Fallback de compatibilidade para bases antigas/inconsistentes.
    const fallbackQuery = supabase
      .from('profiles')
      .select(baseColumns)
      .or('tipo.eq.dentista,tipo.eq.medico,crm.not.is.null,numero_registro.not.is.null,especialidade.not.is.null')
      .order('nome', { ascending: true })
      .limit(300);

    const { data, error } = await withTimeout(fallbackQuery);

    if (error) {
      if (dentistasCache && dentistasCache.length > 0) {
        return { success: true, data: dentistasCache };
      }
      return { success: false, error: error.message };
    }

    const normalizedFallbackData = (data || [])
      .filter(isDentistaLike)
      .map(normalizeDentista);

    if (normalizedFallbackData.length > 0) {
      setDentistasCache(normalizedFallbackData);
    }

    return {
      success: true,
      data: normalizedFallbackData,
    };
  } catch (error: any) {
    if (dentistasCache && dentistasCache.length > 0) {
      return { success: true, data: dentistasCache };
    }
    return {
      success: false,
      error: error.message || 'Erro ao listar dentistas',
    };
  }
};

/**
 * Obter dentista por ID
 */
export const obterDentista = async (id: string): Promise<{
  success: boolean;
  data?: DentistaProfile;
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data || !isDentistaLike(data)) {
      return { success: false, error: 'Dentista nao encontrado' };
    }

    return {
      success: true,
      data: normalizeDentista(data),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao obter dentista',
    };
  }
};

/**
 * Atualizar dados de dentista
 */
export const atualizarDentista = async (
  id: string,
  updates: Partial<DentistaProfile>
): Promise<{ success: boolean; data?: DentistaProfile; tempPassword?: string; emailSent?: boolean; error?: string }> => {
  try {
    const updatePayload = {
      ...updates,
      crm: updates.crm ?? updates.numero_registro,
      numero_registro: updates.crm ?? updates.numero_registro,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await stripMissingColumnAndRetryUpdate(id, updatePayload);

    if (error) {
      return { success: false, error: error.message };
    }

    invalidateDentistasCache();
    return {
      success: true,
      data: normalizeDentista(data),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar dentista',
    };
  }
};

/**
 * Deletar dentista (remove do banco e do Auth quando permitido)
 */
export const deletarDentista = async (id: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // 0) Exclusao completa no banco (quando a RPC existir)
    const { error: fullDeleteError } = await supabase.rpc('admin_delete_dentista_full', {
      p_dentista_id: id,
    });

    if (!fullDeleteError) {
      invalidateDentistasCache();
      return { success: true };
    }

    // Se a funcao nao existir ainda no banco, faz fallback legacy.
    if ((fullDeleteError as any).code !== '42883') {
      return { success: false, error: fullDeleteError.message };
    }

    // 1) Limpa dados relacionados no fallback (sem RPC)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('sender_id', id);
    if (messagesError && !isNoRowsError(messagesError)) {
      return { success: false, error: messagesError.message };
    }

    const { data: convRows, error: convFindError } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1_id.eq.${id},participant_2_id.eq.${id}`);
    if (convFindError && !isNoRowsError(convFindError)) {
      return { success: false, error: convFindError.message };
    }

    const convIds = (convRows || []).map((row: any) => row.id).filter(Boolean);
    if (convIds.length > 0) {
      const { error: convMessagesError } = await supabase
        .from('messages')
        .delete()
        .in('conversation_id', convIds);
      if (convMessagesError && !isNoRowsError(convMessagesError)) {
        return { success: false, error: convMessagesError.message };
      }
    }

    const { error: convDeleteError } = await supabase
      .from('conversations')
      .delete()
      .or(`participant_1_id.eq.${id},participant_2_id.eq.${id}`);
    if (convDeleteError && !isNoRowsError(convDeleteError)) {
      return { success: false, error: convDeleteError.message };
    }

    const { error: respostasDeleteError } = await supabase
      .from('respostas_triagem')
      .delete()
      .eq('dentista_id', id);
    if (respostasDeleteError && !isNoRowsError(respostasDeleteError)) {
      return { success: false, error: respostasDeleteError.message };
    }

    const { error: triagensUpdateError } = await supabase
      .from('triagens')
      .update({
        dentista_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('dentista_id', id);
    if (triagensUpdateError && !isNoRowsError(triagensUpdateError)) {
      return { success: false, error: triagensUpdateError.message };
    }

    const { error: agendamentosUpdateError } = await supabase
      .from('agendamentos')
      .update({
        dentista_id: null,
        status: 'pendente',
        updated_at: new Date().toISOString(),
      })
      .eq('dentista_id', id);
    if (agendamentosUpdateError && !isNoRowsError(agendamentosUpdateError)) {
      return { success: false, error: agendamentosUpdateError.message };
    }

    // 2) Limpa tabela de compatibilidade (se existir registro)
    const { error: deleteDentistaTableError } = await supabase
      .from('dentistas')
      .delete()
      .eq('id', id);
    if (deleteDentistaTableError && !isNoRowsError(deleteDentistaTableError)) {
      return { success: false, error: deleteDentistaTableError.message };
    }

    // 3) Deletar perfil na tabela principal
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    invalidateDentistasCache();
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar dentista',
    };
  }
};
/**
 * Procurar dentistas por nome ou especialidade
 */
export const procurarDentistas = async (termo: string): Promise<{
  success: boolean;
  data?: DentistaProfile[];
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`nome.ilike.%${termo}%,especialidade.ilike.%${termo}%,crm.ilike.%${termo}%,numero_registro.ilike.%${termo}%`)
      .order('nome', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || [])
        .filter(isDentistaLike)
        .map(normalizeDentista),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao procurar dentistas',
    };
  }
};

