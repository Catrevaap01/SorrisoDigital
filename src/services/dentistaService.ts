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
  error?: string;
}

const normalizeDentista = (row: any): DentistaProfile => ({
  ...(row || {}),
  crm: row?.crm || row?.numero_registro || row?.registro || undefined,
});

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
): Promise<CriarDentistaResult> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    // check whether email already exists in profiles (admin can see all)
    const { data: existing, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (findError && (findError as any).code !== 'PGRST116') {
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

    const { data: profileData, error: profileError } =
      await upsertProfile(profilePayload);

    if (profileError) {
      // special-case schema errors to provide more guidance
      if ((profileError as any).code === 'PGRST204') {
        return {
          success: false,
          error:
            'Erro de esquema: coluna inexistente na tabela profiles. Execute o script SUPABASE_SETUP.sql para atualizar o banco de dados.',
        };
      }
      return { success: false, error: profileError.message };
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

    return {
      success: true,
      data: dentista,
      tempPassword: passwordToUse,
      emailSent,
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

