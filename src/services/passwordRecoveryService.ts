/**
 * ServiÃ§o de recuperaÃ§Ã£o de senha
 * FunÃ§Ãµes para gerar senhas aleatÃ³rias e recuperar senhas
 */

import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { sendPasswordRecoveryEmail } from './emailService';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra;
const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const getAdminClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

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
): Promise<{
  success: boolean;
  novaSenha?: string;
  emailSent?: boolean;
  error?: string;
}> => {
  try {
    const novaSenha = gerarSenhaAleatoria();
    const adminClient = getAdminClient();

    const authApi = adminClient?.auth.admin || supabase.auth.admin;
    const { data: userData } = await authApi.getUserById(dentistaId);
    const currentMetadata = userData?.user?.user_metadata || {};

    const { error: updateError } = await authApi.updateUserById(
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
      const rawMessage = (updateError.message || '').toLowerCase();
      if (
        rawMessage.includes('user not allowed') ||
        rawMessage.includes('not allowed')
      ) {
        return {
          success: false,
          error:
            'User not allowed: configure SUPABASE_SERVICE_ROLE_KEY no app.json (extra) para permitir reset de senha por admin.',
        };
      }
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
      return {
        success: true,
        novaSenha,
        emailSent: false,
        error: emailResult.error || 'Senha alterada, mas falha ao enviar email',
      };
    }

    return {
      success: true,
      novaSenha,
      emailSent: true,
    };
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
export const recuperarSenhaPaciente = async (
  pacienteEmail: string
): Promise<{
  success: boolean;
  novaSenha?: string;
  emailSent?: boolean;
  error?: string;
}> => {
  try {
    const adminClient = getAdminClient();
    const authApi = adminClient?.auth.admin || supabase.auth.admin;

    const { data: listData, error: listError } = await authApi.listUsers();
    if (listError) {
      return { success: false, error: listError.message };
    }
    const allUsers = ((listData?.users as Array<{ email?: string; user_metadata?: any; id: string }>) || []);
    const users = allUsers.filter(
      (candidate) =>
        candidate.email?.trim().toLowerCase() ===
        pacienteEmail.trim().toLowerCase()
    );
    if (users.length === 0) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    const user = users[0];
    const tipo = (user.user_metadata?.tipo || '').toString();
    if (tipo !== 'paciente') {
      return {
        success: false,
        error: 'Recuperação apenas disponível para pacientes',
      };
    }

    const novaSenha = gerarSenhaAleatoria();
    const currentMetadata = user.user_metadata || {};

    const { error: updateError } = await authApi.updateUserById(user.id, {
      password: novaSenha,
      user_metadata: {
        ...currentMetadata,
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

    const emailResult = await sendPasswordRecoveryEmail(
      pacienteEmail,
      // nome de metadata ou vazio
      (user.user_metadata?.nome as string) || '',
      novaSenha
    );

    if (!emailResult.success) {
      return {
        success: true,
        novaSenha,
        emailSent: false,
        error: emailResult.error || 'Senha alterada, mas falha ao enviar email',
      };
    }

    return { success: true, novaSenha, emailSent: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao recuperar senha',
    };
  }
};

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
