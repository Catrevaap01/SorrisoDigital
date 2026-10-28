/**
 * ServiÃ§o de recuperaÃ§Ã£o de senha
 * FunÃ§Ãµes para gerar senhas aleatÃ³rias e recuperar senhas
 */

import { supabase, PROFILE_SCHEMA_FEATURES, getAdminClient } from '../config/supabase';
import { sendPasswordRecoveryEmail } from './emailService';
import { SupabaseClient } from '@supabase/supabase-js';

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
export const recuperarSenhaProfissional = async (
  profissionalId: string,
  profissionalEmail: string,
  profissionalNome: string,
  senhaCustomizada?: string
): Promise<{
  success: boolean;
  novaSenha?: string;
  emailSent?: boolean;
  error?: string;
}> => {
  try {
    const novaSenha = (senhaCustomizada || '').trim() || gerarSenhaAleatoria(10);
    const adminClient = getAdminClient();

    const authApi = adminClient?.auth.admin || supabase.auth.admin;
    const { data: userData } = await authApi.getUserById(profissionalId);
    const currentMetadata = userData?.user?.user_metadata || {};

    // 1. Atualiza a senha no Supabase Auth e registra nos metadados
    const { error: updateError } = await authApi.updateUserById(
      profissionalId,
      {
        password: novaSenha,
        user_metadata: {
          ...currentMetadata,
          temp_password: novaSenha,
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

    // 2. Salva temp_password e redefine senha_alterada na tabela profiles
    const dbClient = adminClient || supabase;
    const { error: profileError } = await dbClient
      .from('profiles')
      .update({
        temp_password: novaSenha,
        senha_alterada: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profissionalId);

    if (profileError) {
      console.warn('Aviso ao atualizar profile com temp_password:', profileError.message);
    }

    // 3. Dispara o envio para o e-mail real do profissional
    const emailResult = await sendPasswordRecoveryEmail(
      profissionalEmail.trim().toLowerCase(),
      profissionalNome,
      novaSenha
    );

    return {
      success: true,
      novaSenha,
      emailSent: emailResult.success,
      error: !emailResult.success ? emailResult.error : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao recuperar senha',
    };
  }
};

export const recuperarSenhaDentista = recuperarSenhaProfissional;

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
    // 1. Consultar a tabela profiles para encontrar o ID do usuário e confirmar se é paciente
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, nome, tipo')
      .eq('email', pacienteEmail.trim().toLowerCase())
      .single();

    if (profileError || !profileData) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    if (profileData.tipo !== 'paciente') {
      return {
        success: false,
        error: 'Recuperação apenas disponível para pacientes',
      };
    }

    const userId = profileData.id;
    const nome = profileData.nome || '';

    // 2. Redefinir a senha usando a API de administração
    const adminClient = getAdminClient();
    const authApi = adminClient?.auth.admin || supabase.auth.admin;

    const { data: userData, error: getUserError } = await authApi.getUserById(userId);
    if (getUserError) {
      return { success: false, error: getUserError.message };
    }
    const currentMetadata = userData?.user?.user_metadata || {};

    const novaSenha = gerarSenhaAleatoria();

    const { error: updateError } = await authApi.updateUserById(userId, {
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
      const { error: profileErrorUpdate } = await supabase
        .from('profiles')
        .update({
          senha_alterada: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (profileErrorUpdate) {
        return { success: false, error: profileErrorUpdate.message };
      }
    }

    // 3. Enviar o email de recuperação
    const emailResult = await sendPasswordRecoveryEmail(
      pacienteEmail.trim().toLowerCase(),
      nome,
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
