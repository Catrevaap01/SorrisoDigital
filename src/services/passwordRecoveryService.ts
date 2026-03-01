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
 * Recuperar senha de um dentista (admin only)
 * Gera senha temporaria, envia por email e forca troca no proximo login.
 */
export const recuperarSenhaDentista = async (
  dentistaId: string,
  dentistaEmail: string,
  dentistaNome: string
): Promise<{ success: boolean; novaSenha?: string; emailSent?: boolean; error?: string }> => {
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

    return { success: true, novaSenha, emailSent: emailResult.success };
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

