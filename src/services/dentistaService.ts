/**
 * Serviço de gerenciamento de dentistas
 * Funções para criar, listar, atualizar e deletar dentistas
 */

import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { UserProfile } from '../contexts/AuthContext';

export interface DentistaProfile extends UserProfile {
  especialidade?: string;
  crm?: string;
  telefone?: string;
  provincia?: string;
  foto_url?: string;
}

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
    // 1. Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
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
      return { success: false, error: 'Erro ao criar usuário' };
    }

    // 2. Criar perfil do dentista na tabela profiles
    const profilePayload = Object.fromEntries(
      Object.entries({
        id: authData.user.id,
        email,
        nome,
        tipo: 'dentista',
        especialidade,
        crm,
        telefone: telefone || null,
        provincia: provincia || null,
        senha_alterada: PROFILE_SCHEMA_FEATURES.hasSenhaAlterada ? false : undefined,
        created_at: new Date().toISOString(),
      }).filter(([, value]) => value !== undefined)
    );

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert([profilePayload])
      .select()
      .single();

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    return {
      success: true,
      data: profileData as DentistaProfile,
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
      data: (data || []) as DentistaProfile[],
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
      data: data as DentistaProfile,
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
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tipo', 'dentista')
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data as DentistaProfile,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar dentista',
    };
  }
};

/**
 * Deletar dentista (remove da tabela profiles e marca para deleção no auth)
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
      data: (data || []) as DentistaProfile[],
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao procurar dentistas',
    };
  }
};
