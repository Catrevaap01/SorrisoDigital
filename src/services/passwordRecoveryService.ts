/**
 * ServiÃ§o de recuperaÃ§Ã£o de senha
 * FunÃ§Ãµes para gerar senhas aleatÃ³rias e recuperar senhas
 */

import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { sendPasswordRecoveryEmail } from './emailService';

/**
 * Gerar senha aleatÃ³ria segura
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
 * Consulta tipo de usuário pelo email (paciente, dentista, admin)
 */
export const getUserTipoByEmail = async (
  email: string
): Promise<string | null> => {
  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('tipo', { count: 'exact' })
      .eq('email', email)
      .maybeSingle();
    // maybeSingle returns null if zero rows or object if one; avoids coercion errors
    if (error) {
      console.warn('Erro consultando profiles:', error.message);
      return null;
    }
    return data?.tipo || null;
  } catch (err: any) {
    console.warn('Erro ao buscar tipo de usuário:', err.message);
    return null;
  }
};

/**
 * Recuperar senha de um dentista (admin only)
 * Gera senha temporaria, envia por email e forca troca no proximo login.
 */
export const recuperarSenhaDentista = async (
  dentistaId: string,
  dentistaEmail: string,
  dentistaNome: string
): Promise<{ success: boolean; novaSenha?: string; error?: string }> => {
  try {
    const novaSenha = gerarSenhaAleatoria();

    const { data: userData } = await supabase.auth.admin.getUserById(dentistaId);
    const currentMetadata = userData?.user?.user_metadata || {};

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      dentistaId,
      {
        password: novaSenha,
        user_metadata: {
          ...currentMetadata,
          force_password_change: true,
        },
      }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    if (PROFILE_SCHEMA_FEATURES.hasSenhaAlterada) {
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
    }

    const emailResult = await sendPasswordRecoveryEmail(
      dentistaEmail,
      dentistaNome,
      novaSenha
    );

    if (!emailResult.success) {
      console.warn('Erro ao enviar email de recuperacao:', emailResult.error);
    }

    return { success: true, novaSenha };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao recuperar senha',
    };
  }
};

/**
 * Recuperar senha de um paciente (autoatendimento)
 * Gera senha temporaria, envia por email e forca troca no proximo login.
 */
export const recuperarSenhaPaciente = async (
  email: string
): Promise<{ success: boolean; novaSenha?: string; error?: string }> => {
  try {
    // Encontrar perfil pelo e-mail em vez de listar usuários admin
    const { data: perfil, error: perfilError } = await supabase
      .from('profiles')
      .select('id, tipo, nome')
      .eq('email', email)
      .maybeSingle();
    if (perfilError) {
      return { success: false, error: perfilError.message };
    }
    if (!perfil) {
      return { success: false, error: 'Email não encontrado' };
    }
    if (perfil.tipo !== 'paciente') {
      return { success: false, error: 'Recuperação apenas disponível para pacientes' };
    }

    const novaSenha = gerarSenhaAleatoria();
    const userId = perfil.id;
    // metadata não está disponível aqui, mas não precisamos dela para atualizar senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: novaSenha,
      user_metadata: {
        force_password_change: true,
      },
    });
    if (updateError) {
      return { success: false, error: updateError.message };
    }

    if (PROFILE_SCHEMA_FEATURES.hasSenhaAlterada) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          senha_alterada: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profileError) {
        return { success: false, error: profileError.message };
      }
    }

    const nome = user.user_metadata?.nome || '';
    await sendPasswordRecoveryEmail(email, nome, novaSenha);

    return { success: true, novaSenha };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao recuperar senha',
    };
  }
};

/**
 * Atualizar senha do usuÃ¡rio apÃ³s primeira login (mudanÃ§a obrigatÃ³ria)
 */
export const atualizarSenhaAposLogin = async (
  userId: string,
  novaSenha: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const sessionResult = await supabase.auth.getSession();
    const currentMetadata = sessionResult.data.session?.user?.user_metadata || {};

    // Atualizar senha no Auth
    const { error: authError } = await supabase.auth.updateUser({
      password: novaSenha,
      data: {
        ...currentMetadata,
        force_password_change: false,
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (PROFILE_SCHEMA_FEATURES.hasSenhaAlterada) {
      // Marcar que senha foi alterada.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          senha_alterada: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        return { success: false, error: profileError.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar senha',
    };
  }
};

