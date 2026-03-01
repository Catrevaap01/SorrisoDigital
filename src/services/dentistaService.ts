/**
 * Servico de gerenciamento de dentistas
 * Funcoes para criar, listar, atualizar e deletar dentistas
 */

import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { UserProfile } from '../contexts/AuthContext';

export interface DentistaProfile extends UserProfile {
  especialidade?: string;
  crm?: string;
  numero_registro?: string;
  telefone?: string;
  provincia?: string;
  foto_url?: string;
}

const normalizeDentista = (row: any): DentistaProfile => ({
  ...(row || {}),
  crm: row?.crm || row?.numero_registro || row?.registro || undefined,
});

const stripMissingColumnAndRetryInsert = async (payload: Record<string, any>) => {
  let currentPayload = { ...payload };
  let response = await supabase.from('profiles').insert([currentPayload]).select().single();

  while (response.error && (response.error as any).code === 'PGRST204') {
    const missingColumnMatch = (response.error as any).message?.match(/'([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (!missingColumn || !(missingColumn in currentPayload)) break;

    const { [missingColumn]: _ignored, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
    response = await supabase.from('profiles').insert([currentPayload]).select().single();
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
    .eq('tipo', 'dentista')
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
      .eq('tipo', 'dentista')
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
): Promise<{ success: boolean; data?: DentistaProfile; error?: string }> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { data: previousSessionData } = await supabase.auth.getSession();
    const previousSession = previousSessionData.session;

    // 1. Criar usuario no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: senha,
      options: {
        data: {
          nome,
          tipo: 'dentista',
          especialidade,
          crm,
          force_password_change: true,
        },
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Erro ao criar usuario' };
    }

    // Evita troca de sessao do admin quando o signUp autentica o novo dentista.
    if (previousSession && authData.session) {
      const currentUserId = authData.session.user?.id;
      if (currentUserId && currentUserId !== previousSession.user.id) {
        await supabase.auth.setSession({
          access_token: previousSession.access_token,
          refresh_token: previousSession.refresh_token,
        });
      }
    }

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

    const { data: profileData, error: profileError } =
      await stripMissingColumnAndRetryInsert(profilePayload);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    return {
      success: true,
      data: normalizeDentista(profileData),
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
export const listarDentistas = async (): Promise<{
  success: boolean;
  data?: DentistaProfile[];
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'dentista')
      .order('nome', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map(normalizeDentista),
    };
  } catch (error: any) {
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
      .eq('tipo', 'dentista')
      .single();

    if (error) {
      return { success: false, error: error.message };
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
): Promise<{ success: boolean; data?: DentistaProfile; error?: string }> => {
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
 * Deletar dentista (remove da tabela profiles e marca para delecao no auth)
 */
export const deletarDentista = async (id: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    // 1. Deletar perfil do dentista
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)
      .eq('tipo', 'dentista');

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // 2. Tentar remover usuario no Auth (quando permitido pelo projeto).
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);
    if (authDeleteError) {
      console.warn('Perfil removido, mas nao foi possivel remover usuario no Auth:', authDeleteError.message);
    }

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
      .eq('tipo', 'dentista')
      .or(`nome.ilike.%${termo}%,especialidade.ilike.%${termo}%`)
      .order('nome', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map(normalizeDentista),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao procurar dentistas',
    };
  }
};

/**
 * Carrega lista de especialidades já utilizadas por dentistas cadastrados.
 * Retorna array de strings ordenado alfabeticamente.
 */
export const listarEspecialidadesDentistas = async (): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('especialidade')
      .eq('tipo', 'dentista')
      .is('especialidade', null, { foreignTable: 'profiles' }) // workaround to include null; not necessary
      .neq('especialidade', '')
      .order('especialidade', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    // supabase returns array of objects { especialidade: '...' }
    const list = (data as any[])
      .map((r) => r.especialidade)
      .filter((v): v is string => !!v);
    // remove duplicates just in case
    const unique = Array.from(new Set(list));
    unique.sort();

    return { success: true, data: unique };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao listar especialidades' };
  }
};

/**
 * Carrega lista de províncias já utilizadas por dentistas.
 */
export const listarProvinciasDentistas = async (): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('provincia')
      .eq('tipo', 'dentista')
      .neq('provincia', '')
      .order('provincia', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const list = (data as any[])
      .map((r) => r.provincia)
      .filter((v): v is string => !!v);
    const unique = Array.from(new Set(list));
    unique.sort();

    return { success: true, data: unique };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao listar provincias' };
  }
};

