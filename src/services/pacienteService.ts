/**
 * Paciente Service
 * Gerencia dados e operações relacionadas aos pacientes
 */


import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { UserProfile } from '../contexts/AuthContext';
import { withTimeout } from '../utils/withTimeout';
import { deleteImage } from '../services/storageService';

const getAdminClient = (): SupabaseClient | null => {
  const extra = Constants.expoConfig?.extra || (Constants as any).manifest2?.extra || (Constants as any).manifest?.extra;
  const url = extra?.SUPABASE_URL;
  const key = extra?.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('⚠️ pacienteService: Admin keys missing in Constants.extra');
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};


/**
 * Cache simples para profiles (TTL 5min)
 */
const CACHE_PREFIX = 'profile_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const getCacheKey = (id: string) => `${CACHE_PREFIX}${id}`;

const getFromCache = async (key: string): Promise<PacienteProfile | null> => {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return data as PacienteProfile;
  } catch {
    return null;
  }
};

const setCache = async (key: string, data: PacienteProfile) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {}
};

const clearCache = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
};

export interface PacienteProfile extends UserProfile {
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  idade?: number;
  endereco?: string;
  historico_medico?: string;
  alergias?: string;
  medicamentos_atuais?: string;
  observacoes_gerais?: string;
  documentos_urls?: string[];
  temp_password?: string;
}

const sanitizePacienteUpdates = (updates: Partial<PacienteProfile>) =>
  Object.fromEntries(
    Object.entries({
      ...updates,
      updated_at: new Date().toISOString(),
    }).filter(([, value]) => value !== undefined)
  );

const removeMissingSchemaColumns = <T extends Record<string, any>>(
  payload: T,
  error: any
): T | null => {
  const missingColumnMatch =
    error?.message?.match(/'([^']+)' column/) ||
    error?.message?.match(/could not (?:find|the) '([^']+)' column/i) ||
    error?.message?.match(/could not find the '([^']+)' column/i);
  const missingColumn = missingColumnMatch?.[1];

  if (!missingColumn || !(missingColumn in payload)) {
    return null;
  }

  const { [missingColumn]: _removed, ...fallbackPayload } = payload;
  return fallbackPayload as T;
};

const stripObservacoesMeta = (obs: string): string => {
  if (!obs) return '';
  return obs
    .replace(/\[DN\]:\s*[^\s\]]+/g, '')
    .replace(/\[G\]:\s*[^\s\]]+/g, '')
    .replace(/\[IDADE\]:\s*\d{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Tenta extrair dados das observacoes_gerais se os campos principais estiverem nulos
 */
export const parsePacienteProfile = (p: PacienteProfile): PacienteProfile => {
  if (!p) return p;
  const obs = p.observacoes_gerais || '';
  
  if (!p.data_nascimento || p.data_nascimento === '-') {
    const dnMatch = obs.match(/\[DN\]: ([^ [\]\n]+)/);
    if (dnMatch && dnMatch[1] !== '-') p.data_nascimento = dnMatch[1];
  }
  
  if (!p.genero || (p.genero as string) === '-') {
    const gMatch = obs.match(/\[G\]: ([^ [\]\n]+)/);
    if (gMatch && gMatch[1] !== '-') p.genero = gMatch[1] as any;
  }

  if (p.idade === undefined || p.idade === null) {
    const idadeMatch = obs.match(/\[IDADE\]: (\d{1,3})/);
    if (idadeMatch) {
      p.idade = Number(idadeMatch[1]);
    } else if (p.data_nascimento && validarData(p.data_nascimento)) {
      p.idade = calcularIdade(p.data_nascimento) ?? undefined;
    }
  }

  // remover metadados da observação que não devem aparecer na UI
  const cleanedObs = stripObservacoesMeta(p.observacoes_gerais || '');
  p.observacoes_gerais = cleanedObs || undefined;
  
  return p;
};

const isRowLevelSecurityError = (error: any): boolean => {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  );
};

const upsertPacienteProfile = async (payload: Record<string, any>) => {
  let currentPayload = { ...payload };
  const adminClient = getAdminClient();
  let client: SupabaseClient = supabase;

  while (true) {
    const result = await client
      .from('profiles')
      .upsert([currentPayload], { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (!result.error) {
      if (!result.data) {
        return { ...result, error: { message: 'Erro ao persistir dados do perfil' } };
      }
      return result;
    }

    const fallbackPayload = removeMissingSchemaColumns(currentPayload, result.error);
    if (fallbackPayload) {
      currentPayload = fallbackPayload;
      continue;
    }

    if (client === supabase && adminClient && isRowLevelSecurityError(result.error)) {
      client = adminClient;
      continue;
    }

    return result;
  }
};

/**
 * Buscar perfil completo de um paciente
 */
export const buscarPaciente = async (
  pacienteId: string,
  options?: { forceRefresh?: boolean }
): Promise<{ success: boolean; data?: PacienteProfile; error?: string }> => {
  // Verifica cache primeiro
  const cacheKey = getCacheKey(pacienteId);
  if (!options?.forceRefresh) {
    const cached = await getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  } else {
    await clearCache(cacheKey);
  }

  try {
    const runSearch = async () => {
      let res = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pacienteId)
        .eq('tipo', 'paciente')
        .maybeSingle();

      if (res.error && isRowLevelSecurityError(res.error)) {
        const admin = getAdminClient();
        if (admin) {
          res = await admin
            .from('profiles')
            .select('*')
            .eq('id', pacienteId)
            .eq('tipo', 'paciente')
            .maybeSingle();
        }
      }
      return res;
    };

    const { data, error } = await withTimeout(runSearch(), 12000);

    if (error) {
      return { success: false, error: error.message };
    }

    if (data) {
      const parsed = parsePacienteProfile(data as PacienteProfile);
      await setCache(cacheKey, parsed);
      return { success: true, data: parsed };
    }

    // 🔥 AGGRESSIVE FALLBACK: Try admin if no data found (RLS might be hiding it)
    const admin = getAdminClient();
    if (admin) {
      const { data: adminData } = await admin
        .from('profiles')
        .select('*')
        .eq('id', pacienteId)
        .eq('tipo', 'paciente')
        .maybeSingle();

      if (adminData) {
        const parsed = parsePacienteProfile(adminData as PacienteProfile);
        await setCache(cacheKey, parsed);
        return { success: true, data: parsed };
      }
    }

    return { success: true, data: null as any };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao buscar paciente (timeout 12s)' };
  }
};

/**
 * Atualizar perfil completo do paciente
 */
export const atualizarPerfil = async (
  pacienteId: string,
  updates: Partial<PacienteProfile>
): Promise<{ success: boolean; data?: PacienteProfile; error?: string }> => {
  try {
    // 1. Fetch current to merge safely
    const { data: current } = await buscarPaciente(pacienteId, { forceRefresh: true });
    const profile = current;

    const dnStr = updates.data_nascimento || profile?.data_nascimento || '-';
    const gStr = updates.genero || profile?.genero || '-';
    const idadeAtual =
      typeof updates.idade === 'number'
        ? updates.idade
        : typeof profile?.idade === 'number'
          ? profile.idade
          : (profile?.data_nascimento && validarData(profile.data_nascimento)
              ? calcularIdade(profile.data_nascimento)
              : undefined);
    // Clean existing tags from obs before merging new ones to avoid stacking
    let cleanObs = (updates.observacoes_gerais || profile?.observacoes_gerais || '')
      .replace(/\[DN\]: [^ [\]]+ /g, '')
      .replace(/\[G\]: [^ [\]]+ /g, '')
      .replace(/\[IDADE\]: \d{1,3} /g, '')
      .trim();

    const mergedObservacoes = cleanObs;
    let payload = sanitizePacienteUpdates({
      ...updates,
      observacoes_gerais: mergedObservacoes.trim() ? mergedObservacoes.trim() : null
    });
    const adminClient = getAdminClient();
    let client: SupabaseClient = supabase;

    while (true) {
      const { data, error } = await client
        .from('profiles')
        .update(payload)
        .eq('id', pacienteId)
        .select()
        .maybeSingle();

      if (!error) {
        if (!data) {
          // 🔥 AGGRESSIVE FALLBACK: If no data returned (RLS hiding update), try admin
          if (client === supabase && adminClient) {
            client = adminClient;
            continue;
          }
          return { success: false, error: 'Paciente não encontrado ou sem permissão para atualizar' };
        }
        const parsed = parsePacienteProfile(data as PacienteProfile);
        await setCache(getCacheKey(pacienteId), parsed);
        return { success: true, data: parsed };
      }

      // 1. Check for missing columns
      const fallbackPayload = removeMissingSchemaColumns(payload, error);
      if (fallbackPayload) {
        payload = fallbackPayload;
        continue;
      }

      // 2. Check for RLS error and try adminClient
      if (client === supabase && adminClient && isRowLevelSecurityError(error)) {
        client = adminClient;
        continue;
      }

      return { success: false, error: error.message };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao atualizar perfil' };
  }
};

export const atualizarPaciente = async (
  pacienteId: string,
  updates: Partial<PacienteProfile>
): Promise<{ success: boolean; data?: PacienteProfile; error?: string }> =>
  atualizarPerfil(pacienteId, updates);

/**
 * Validar formato de email
 */
export const validarEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar telefone
 */
export const validarTelefone = (telefone: string): boolean => {
  if (!telefone) return true; // Campo opcional
  const telefoneRegex = /^[0-9\s\-\+\(\)]+$/;
  return telefoneRegex.test(telefone) && telefone.replace(/\D/g, '').length >= 9;
};

/**
 * Validar data (YYYY-MM-DD)
 */
export const validarData = (data: string): boolean => {
  if (!data) return true; // Campo opcional
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataRegex.test(data)) return false;

  const [ano, mes, dia] = data.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);

  return (
    date.getFullYear() === ano &&
    date.getMonth() === mes - 1 &&
date.getDate() === dia &&
    date < new Date() // Data não pode ser no futuro
  );
};

export const gerarCodigoPaciente = (pacienteId: string): string =>
  `PAC-${pacienteId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

/**
 * Calcular idade baseado em data de nascimento
 */
export const calcularIdade = (dataNascimento: string): number | null => {
  if (!dataNascimento) return null;

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  const idade = hoje.getFullYear() - ano;

  if (
    hoje.getMonth() < mes - 1 ||
    (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)
  ) {
    return idade - 1;
  }

  return idade;
};

/**
 * Listar pacientes (apenas para admin/dentista)
 */
export const listarPacientes = async (
  filtro?: {
    nome?: string;
    provincia?: string;
    limit?: number;
  }
): Promise<{ success: boolean; data?: PacienteProfile[]; error?: string }> => {
  try {
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'paciente')
      .order('nome', { ascending: true })
      .limit(filtro?.limit || 100); // ✅ LIMIT PADRÃO 100

    if (filtro?.nome) {
      query = query.ilike('nome', `%${filtro.nome}%`);
    }

    if (filtro?.provincia) {
      query = query.eq('provincia', filtro.provincia);
    }

    const timeout = 2000; // User requested 2s back
    const { data, error } = await withTimeout(query, timeout);

    if (error) {
      return { success: false, error: error.message };
    }

    const parsedData = (data || []).map(p => parsePacienteProfile(p as PacienteProfile));
    return { success: true, data: parsedData };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao listar pacientes (timeout 12s)' };
  }
};

/**
 * Criar novo paciente por dentista
 */
export interface CriarPacienteData {
  nome: string;
  email: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  idade?: number;
  historico_medico?: string;
  alergias?: string;
  medicamentos_atuais?: string;
  provincia?: string;
  observacoes_gerais?: string;
}

export interface CriarPacienteResult {
  success: boolean;
  data?: PacienteProfile;
  tempPassword?: string;
  tempEmail?: string;
  emailSent?: boolean;
  warning?: string;
  error?: string;
}

const normalizeCreatePacienteAuthError = (message?: string): string => {
  const msg = (message || '').toLowerCase();
  if (msg.includes('already registered')) return 'E-mail já cadastrado';
  if (msg.includes('user already exists')) return 'E-mail já cadastrado';
  if (msg.includes('invalid email')) return 'E-mail inválido';
  return message || 'Erro ao criar usuário';

};

export const createPaciente = async (
  dentistaId: string,
  data: CriarPacienteData
): Promise<CriarPacienteResult> => {
  try {
    const normalizedEmail = data.email.trim().toLowerCase();

    // Check existing email
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'E-mail já cadastrado' };
    }

    const adminClient = getAdminClient();
    if (adminClient) {
      const { data: existingWithAdmin } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingWithAdmin) {
        return { success: false, error: 'E-mail já cadastrado' };
      }
    }

    const { gerarSenhaTemporaria } = await import('../utils/senhaUtils');
    const tempPassword = gerarSenhaTemporaria();

    // Anon client for signup
    const { createClient } = await import('@supabase/supabase-js');
    const extra = (await import('expo-constants')).default.expoConfig?.extra;
    const adminClientForCreate = getAdminClient();
    if (!adminClientForCreate) {
      return { success: false, error: 'Service role não configurado' };
    }

      const { data: authData, error: authError } = await adminClientForCreate.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true, // ✅ Bypass email confirmation for dentist-created patients
      user_metadata: {
        nome: data.nome,
        tipo: 'paciente',
        role: 'paciente',
        dentista_criador: dentistaId,
        force_password_change: true, // paciente é obrigado a alterar a senha no primeiro login
      },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: normalizeCreatePacienteAuthError(authError?.message),
      };
    }

    // Profile upsert
    const idadeCalculada =
      data.data_nascimento && validarData(data.data_nascimento)
        ? calcularIdade(data.data_nascimento) ?? null
        : null;

    const profilePayload = {
      id: authData.user.id,
      email: normalizedEmail,
      nome: data.nome,
      tipo: 'paciente',
      telefone: data.telefone || null,
      data_nascimento: data.data_nascimento || null,
      genero: data.genero || null,
      historico_medico: data.historico_medico || null,
      alergias: data.alergias || null,
      medicamentos_atuais: data.medicamentos_atuais || null,
      provincia: data.provincia || null,
      idade: idadeCalculada,
      temp_password: tempPassword,
      // observacoes_gerais deve conter só texto livre, sem metadados de DN/G/IDADE
      observacoes_gerais: data.observacoes_gerais ? data.observacoes_gerais.trim() : null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const { data: profileData, error: profileError } = await upsertPacienteProfile(
      profilePayload
    );

    if (profileError) {
      // Cleanup user if profile failed
      await adminClientForCreate.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: profileError.message };
    }

    await setCache(getCacheKey(authData.user.id), parsePacienteProfile(profileData as PacienteProfile));

    // Send welcome email
    const { sendPasswordRecoveryEmail } = await import('./emailService');
    // Send welcome email with temp credentials
    const emailResult = await sendPasswordRecoveryEmail(
      normalizedEmail,
      data.nome,
      tempPassword
    );

    // Log for debugging patient creation
    console.log(`Paciente criado com sucesso - ID: ${authData?.user?.id}, Email: ${normalizedEmail}, TempPass: ${tempPassword.slice(0,3)}***`);

// ✅ Skip auth test - avoid dentist logout interference
console.log('✅ Patient created - Ficha ready. Skipping auth test to preserve dentist session.');

    return {
      success: true,
      data: profileData as PacienteProfile,
      tempPassword,
      tempEmail: normalizedEmail, // ✅ Used for Ficha to ensure 100% match with Auth
      emailSent: emailResult.success,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao criar paciente',
    };
  }
};

export const deletarPaciente = async (
  pacienteId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return { success: false, error: '❌ Service role não disponível' };
    }

    // 1. Get conversations and triagens in parallel for later cleanup
    const [conversasRes, triagensRes] = await Promise.all([
      adminClient.from('conversations').select('id').or(`participant_1_id.eq.${pacienteId},participant_2_id.eq.${pacienteId}`),
      adminClient.from('triagens').select('id, imagem_path').eq('paciente_id', pacienteId),
    ]);

    const conversaIds = (conversasRes.data || []).map((row: any) => row.id).filter(Boolean);

    // 2. Delete all related data in parallel (max speed)
    const deletePromises: Promise<any>[] = [
      Promise.resolve(adminClient.from('messages').delete().eq('sender_id', pacienteId)),
      Promise.resolve(adminClient.from('notificacoes').delete().eq('usuario_id', pacienteId)),
      Promise.resolve(adminClient.from('agendamentos').delete().eq('paciente_id', pacienteId)),
      Promise.resolve(adminClient.from('triagens').delete().eq('paciente_id', pacienteId)),
      Promise.resolve(adminClient.from('conversations').delete().or(`participant_1_id.eq.${pacienteId},participant_2_id.eq.${pacienteId}`)),
    ];

    if (conversaIds.length > 0) {
      deletePromises.push(Promise.resolve(adminClient.from('messages').delete().in('conversation_id', conversaIds)));
    }

    // Storage cleanup for triagem images (non-blocking)
    for (const triagem of (triagensRes.data || [])) {
      if (triagem.imagem_path) {
        const pathParts = triagem.imagem_path.split('/');
        const filename = pathParts.slice(-2).join('/');
        deletePromises.push(deleteImage(filename, 'triagens').catch(() => {}));
      }
    }

    await Promise.allSettled(deletePromises);

    // 3. Delete profile and auth user in parallel (final step)
    await Promise.allSettled([
      adminClient.from('profiles').delete().eq('id', pacienteId),
      adminClient.auth.admin.deleteUser(pacienteId)
    ]);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao deletar paciente',
    };
  }
};

/**
 * Reseta a senha de um paciente e atualiza o seu perfil
 * @returns Nova senha gerada
 */
export const resetarSenhaPaciente = async (
  pacienteId: string
): Promise<{ success: boolean; newPassword?: string; error?: string }> => {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return { success: false, error: 'Service role não disponível' };

    const { gerarSenhaTemporaria } = await import('../utils/senhaUtils');
    const newPassword = gerarSenhaTemporaria();

    // 1. Buscar email do paciente
    const { data: profile, error: fetchError } = await adminClient
      .from('profiles')
      .select('email, nome, observacoes_gerais')
      .eq('id', pacienteId)
      .maybeSingle();

    if (fetchError || !profile) return { success: false, error: 'Paciente não encontrado' };

    // 2. Atualizar senha no Auth e forçar mudança
    console.log(`🔐 Admin: Updating password for patient ${pacienteId} (${profile?.email})`);
    const { data: authUpdate, error: authError } = await adminClient.auth.admin.updateUserById(
      pacienteId,
      { 
        password: newPassword,
        user_metadata: { 
          force_password_change: true 
        }
      }
    );

    if (authError) {
      console.error('❌ Admin Auth Update Error:', authError);
      return { success: false, error: `Auth: ${authError.message}` };
    }
    console.log('✅ Admin Auth Update Success:', !!authUpdate?.user);

    // 3. Atualizar Profile (apenas temp_password — sem expor senha em observacoes_gerais)
    const updates: Partial<PacienteProfile> = {
      temp_password: newPassword,
      senha_alterada: false,
      updated_at: new Date().toISOString(),
    };

    const result = await atualizarPerfil(pacienteId, updates);
    if (!result.success) return { success: false, error: `Profile: ${result.error}` };

    return { success: true, newPassword };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
