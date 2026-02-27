/**
 * Serviço de recuperação de senha
 * Funções para gerar senhas aleatórias e recuperar senhas
 */

import { supabase } from '../config/supabase';
import { sendPasswordRecoveryEmail } from './emailService';

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
 * Recuperar senha de um dentista (admin only)
 */
export const recuperarSenhaDentista = async (
  dentistaId: string,
  dentistaEmail: string,
  dentistaNome: string
): Promise<{ success: boolean; novaSenha?: string; error?: string }> => {
  try {
    // Gerar nova senha
    const novaSenha = gerarSenhaAleatoria();

    // Atualizar senha no Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      dentistaId,
      {
        password: novaSenha,
      }
    );

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Marcar que precisa alterar senha no próximo login
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

    // Enviar email com nova senha
    const emailResult = await sendPasswordRecoveryEmail(
      dentistaEmail,
      dentistaNome,
      novaSenha
    );

    if (!emailResult.success) {
      // Log do erro mas não impede o retorno da senha
      console.warn('Erro ao enviar email:', emailResult.error);
    }

    return {
      success: true,
      novaSenha,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao recuperar senha',
    };
  }
};

/**
 * Atualizar senha do usuário após primeira login (mudança obrigatória)
 */
export const atualizarSenhaAposLogin = async (
  userId: string,
  novaSenha: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Atualizar senha no Auth
    const { error: authError } = await supabase.auth.updateUser({
      password: novaSenha,
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    // Marcar que senha foi alterada
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

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao atualizar senha',
    };
  }
};
