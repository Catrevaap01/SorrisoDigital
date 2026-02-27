/**
 * Serviço de gerenciamento de dentistas
 * Funções para criar, listar, atualizar e deletar dentistas
 */

import { supabase } from '../config/supabase';
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
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email,
          nome,
          tipo: 'dentista',
          especialidade,
          crm,
          telefone: telefone || null,
          provincia: provincia || null,
          senha_alterada: false,
          created_at: new Date().toISOString(),
        },
      ])
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

/**
 * Gerar senha aleatória segura
 */
export const gerarSenhaAleatoria = (length: number = 12): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let senha = '';
  for (let i = 0; i < length; i++) {
    senha += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return senha;
};

/**
 * Resetar senha de dentista (apenas admin)
 */
export const resetarSenhaDentista = async (
  dentistaId: string
): Promise<{ success: boolean; novaSenha?: string; error?: string }> => {
  try {
    const novaSenha = gerarSenhaAleatoria();

    // Atualizar senha no Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      dentistaId,
      {
        password: novaSenha,
      }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Marcar que precisa alterar senha
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        senha_alterada: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dentistaId);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    return {
      success: true,
      novaSenha,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao resetar senha',
    };
  }
};
