/**
 * Serviço de Autenticação
 * Centraliza toda a lógica de autenticação
 */

import { AuthSession, SupabaseClient, createClient } from '@supabase/supabase-js';
import { supabase, PROFILE_SCHEMA_FEATURES, SUPABASE_ANON_KEY, SUPABASE_URL, getAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';
import { validators } from '../utils/validators';

export interface SignInParams {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  nome: string;
  tipo?: string;
  telefone?: string;
  provincia?: string;
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | 'Outro';
}

export type AdminCreateUserParams = Omit<SignUpParams, 'email' | 'password'> & {
  role?: 'secretario' | 'dentista';
  tipo?: 'secretario' | 'dentista';
  emailConfirm?: boolean;
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | 'Outro';
};

export interface AuthServiceResult<T> {
  success: boolean;
  data?: T;
  error?: HandledError | { message: string };
}

const createAdminClient = getAdminClient;

const isNoRowsError = (error: unknown): boolean =>
  !!error &&
  ((error as any)?.code === 'PGRST116' ||
    String((error as any)?.message || '')
      .toLowerCase()
      .includes('no rows'));

const isRowLevelSecurityError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    (error as any)?.code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security')
  );
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

const PROVINCIAS_STATIC_ORDER = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huila',
  'Bie',
  'Malanje',
  'Uige',
  'Zaire',
  'Cabinda',
  'Cunene',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Namibe',
  'Bengo',
];

const PROVINCIA_REPLACEMENTS: Array<[string, string]> = [
  ['kwando kubango', 'cuando cubango'],
  ['kuando kubango', 'cuando cubango'],
  ['kwando cubango', 'cuando cubango'],
  ['kwanza norte', 'cuanza norte'],
  ['kuanza norte', 'cuanza norte'],
  ['kwanza sul', 'cuanza sul'],
  ['kuanza sul', 'cuanza sul'],
  ['huila', 'huila'],
  ['bie', 'bie'],
  ['uige', 'uige'],
];

const canonicalizeProvinciaName = (value: string): string => {
  let normalized = normalizeText(value);
  PROVINCIA_REPLACEMENTS.forEach(([from, to]) => {
    normalized = normalized.replace(new RegExp(from, 'g'), to);
  });
  normalized = normalized.replace(/[^a-z0-9 ]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
};

const resolveProvinciaIdFromStaticList = (nomeProvincia: string): number | undefined => {
  const target = canonicalizeProvinciaName(nomeProvincia);
  const index = PROVINCIAS_STATIC_ORDER.findIndex(
    (provincia) => canonicalizeProvinciaName(provincia) === target
  );
  return index >= 0 ? index + 1 : undefined;
};

const resolveProvinciaId = async (nomeProvincia?: string): Promise<number | undefined> => {
  const provinciaNome = nomeProvincia?.trim();

  if (!PROFILE_SCHEMA_FEATURES.usesProvinciaId || !provinciaNome) {
    return undefined;
  }

  const { data: exactData, error: exactError } = await supabase
    .from('provincias')
    .select('id')
    .eq('nome', provinciaNome)
    .single();

  if (!exactError && exactData?.id) {
    return exactData.id;
  }

  const { data: ilikeData, error: ilikeError } = await supabase
    .from('provincias')
    .select('id, nome')
    .ilike('nome', provinciaNome)
    .limit(1)
    .maybeSingle();

  if (!ilikeError && ilikeData?.id) {
    return ilikeData.id;
  }

  const { data: allProvincias, error: allError } = await supabase
    .from('provincias')
    .select('id, nome');

  if (allError) {
    logger.warn('authService: nao foi possivel resolver provincia_id por nome', allError);
    return resolveProvinciaIdFromStaticList(provinciaNome);
  }

  const target = canonicalizeProvinciaName(provinciaNome);
  const matched = (allProvincias || []).find(
    (provincia: any) => canonicalizeProvinciaName(provincia.nome) === target
  );

  return matched?.id ?? resolveProvinciaIdFromStaticList(provinciaNome);
};

const validarDataNascimento = (data?: string): boolean => {
  if (!data) return true;
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataRegex.test(data)) return false;

  const [ano, mes, dia] = data.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);

  return (
    date.getFullYear() === ano &&
    date.getMonth() === mes - 1 &&
    date.getDate() === dia &&
    date < new Date()
  );
};

const calcularIdade = (dataNascimento?: string): number | undefined => {
  if (!dataNascimento || !validarDataNascimento(dataNascimento)) return undefined;

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;

  if (
    hoje.getMonth() < mes - 1 ||
    (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)
  ) {
    idade -= 1;
  }

  return idade;
};

const upsertProfile = async (
  client: SupabaseClient,
  payload: Record<string, any>
) => {
  let currentPayload = { ...payload };
  let response = await client
    .from('profiles')
    .upsert([currentPayload], { onConflict: 'id' })
    .select()
    .single();

  while (
    response.error &&
    (response.error as any).code === 'PGRST204'
  ) {
    const missingColumnMatch = (response.error as any).message?.match(/'([^']+)' column/);
    const missingColumn = missingColumnMatch?.[1];
    if (!missingColumn || !(missingColumn in currentPayload)) break;
    const { [missingColumn]: _ignored, ...nextPayload } = currentPayload;
    currentPayload = nextPayload;
    response = await client
      .from('profiles')
      .upsert([currentPayload], { onConflict: 'id' })
      .select()
      .single();
  }

  return response;
};

const createAnonAuthClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

export const authService = {
  /**
   * Fazer login com email e password
   */
  signIn: async (email: string, password: string): Promise<AuthServiceResult<unknown>> => {
    try {
      // Validação
      if (!validators.isValidEmail(email)) {
        return {
          success: false,
          error: { message: 'Email inválido' },
        };
      }

      if (!validators.isValidPassword(password)) {
        return {
          success: false,
          error: { message: 'Senha deve ter pelo menos 6 caracteres' },
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      logger.info('User signed in successfully');
      return { success: true, data };
    } catch (error) {
      const handledError = handleError(error, 'authService.signIn');
      return { success: false, error: handledError };
    }
  },

  /**
   * Registar novo utilizador
   */
  signUp: async (
    email: string,
    password: string,
    userData: Omit<SignUpParams, 'email' | 'password'>
  ): Promise<AuthServiceResult<unknown>> => {
    try {
      // Validações
      const validation = validators.validate(
        { email, password, nome: userData.nome },
        {
          email: [
            {
              validator: validators.isValidEmail,
              message: 'Email inválido',
            },
          ],
          password: [
            {
              validator: validators.isValidPassword,
              message: 'Senha deve ter pelo menos 6 caracteres',
            },
          ],
          nome: [
            {
              validator: validators.isValidName,
              message: 'Nome deve ter entre 3 e 100 caracteres',
            },
          ],
        }
      );

      if (!validation.isValid) {
        return {
          success: false,
          error: { message: Object.values(validation.errors)[0][0] },
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nome: userData.nome,
            tipo: userData.tipo || 'paciente',
          },
        },
      });

      if (error) throw error;

      logger.info('User signed up successfully');
      return { success: true, data };
    } catch (error) {
      const handledError = handleError(error, 'authService.signUp');
      return { success: false, error: handledError };
    }
  },

  adminListSecretarios: async (): Promise<AuthServiceResult<any[]>> => {
    try {
      const adminClient = createAdminClient();
      const client = adminClient ?? supabase;

      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('tipo', 'secretario')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      const handledError = handleError(error, 'authService.adminListSecretarios');
      return { success: false, error: handledError };
    }
  },

  adminListDentistas: async (): Promise<AuthServiceResult<any[]>> => {
    try {
      const adminClient = createAdminClient();
      const client = adminClient ?? supabase;

      const { data, error } = await client
        .from('profiles')
        .select('id, nome, email, telefone, especialidade, crm, created_at')
        .eq('tipo', 'dentista')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      const handledError = handleError(error, 'authService.adminListDentistas');
      return { success: false, error: handledError };
    }
  },

  adminListProfissionais: async (): Promise<AuthServiceResult<any[]>> => {
    try {
      const adminClient = createAdminClient();
      const client = adminClient ?? supabase;

      const { data, error } = await client
        .from('profiles')
        .select('id, nome, email, telefone, especialidade, crm, created_at, tipo')
        .in('tipo', ['dentista', 'medico', 'secretario'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      const handledError = handleError(error, 'authService.adminListProfissionais');
      return { success: false, error: handledError };
    }
  },

  adminCreateUser: async (
    email: string,
    password: string,
    userData: AdminCreateUserParams
  ): Promise<AuthServiceResult<unknown>> => {
    try {
      if (!validators.isValidEmail(email)) {
        return { success: false, error: { message: 'E-mail inválido' } };
      }
      if (!validators.isValidPassword(password)) {
        return { success: false, error: { message: 'Senha deve ter pelo menos 6 caracteres' } };
      }
      if (!userData.nome || !userData.nome.trim()) {
        return { success: false, error: { message: 'Nome obrigatório' } };
      }

      if (userData.data_nascimento && !validarDataNascimento(userData.data_nascimento)) {
        return { success: false, error: { message: 'Data de nascimento invÃ¡lida' } };
      }

      let warningMessage: string | undefined;
      const normalizedEmail = email.trim().toLowerCase();
      const adminClient = createAdminClient();
      if (!adminClient) {
        return {
          success: false,
          error: {
            message:
              'Chave service role não configurada. Adicione SUPABASE_SERVICE_ROLE_KEY em app.json (extra) para criar secretários.',
          },
        };
      }

      const authApi = adminClient.auth.admin;

      const resolvedType = (userData.tipo || userData.role || 'secretario') as 'secretario' | 'dentista';
      const resolvedRole = (userData.role || resolvedType) as 'secretario' | 'dentista';
      const provinciaId = await resolveProvinciaId(userData.provincia);
      const idadeCalculada = calcularIdade(userData.data_nascimento);
      const observacoesGerais = `[DN]: ${userData.data_nascimento || '-'} [G]: ${userData.genero || '-'} [IDADE]: ${idadeCalculada ?? '-'}`;
      const shouldForcePasswordChange = resolvedType === 'secretario' || resolvedType === 'dentista';
      const authMetadata = {
        nome: userData.nome,
        tipo: resolvedType,
        role: resolvedRole,
        telefone: userData.telefone,
        data_nascimento: userData.data_nascimento,
        genero: userData.genero,
        force_password_change: shouldForcePasswordChange,
      };

      const makeProfilePayload = (id: string) =>
        Object.fromEntries(
          Object.entries({
            id,
            email: normalizedEmail,
            nome: userData.nome,
            tipo: resolvedType,
            telefone: userData.telefone || null,
            data_nascimento: userData.data_nascimento || null,
            genero: userData.genero || null,
            idade: idadeCalculada ?? null,
            observacoes_gerais: observacoesGerais,
            provincia: PROFILE_SCHEMA_FEATURES.hasProvincia ? userData.provincia || null : undefined,
            provincia_id: PROFILE_SCHEMA_FEATURES.usesProvinciaId ? provinciaId ?? null : undefined,
            senha_alterada: PROFILE_SCHEMA_FEATURES.hasSenhaAlterada ? false : undefined,
            created_at: new Date().toISOString(),
          }).filter(([, value]) => value !== undefined)
        );

      const ensureProfileForUser = async (userId: string) => {
        const profilePayload = makeProfilePayload(userId);
        const profileResponse = await upsertProfile(adminClient, profilePayload);
        if (profileResponse.error) {
          return { success: false, error: profileResponse.error };
        }
        return { success: true, data: profileResponse.data };
      };

      const findAuthUserByEmail = async (email: string): Promise<any | null> => {
        let page = 1;
        const perPage = 100;

        while (true) {
          const { data, error: listError } = await authApi.listUsers({ page, perPage });
          if (listError) {
            logger.warn('authService.adminCreateUser: falha ao listar usuários Auth', listError);
            return null;
          }

          const users = (data as any)?.users as any[] | undefined;
          const found = users?.find((user) => user.email?.trim().toLowerCase() === email);
          if (found) return found;

          const nextPage = (data as any)?.nextPage;
          if (!nextPage) break;
          page = nextPage;
        }

        return null;
      };

      const existingAuthUser = await findAuthUserByEmail(normalizedEmail);
      const { data: existingProfile, error: existingError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingError) {
        const existingMessage = String(existingError.message || existingError || 'Erro ao verificar e-mail existente');
        logger.error('authService.adminCreateUser: erro ao verificar e-mail existente', existingError);
        return { success: false, error: { message: existingMessage } };
      }

      if (existingAuthUser) {
        if (!existingProfile) {
          const ensureResult = await ensureProfileForUser(existingAuthUser.id);
          if (ensureResult.success) {
            return {
              success: true,
              data: {
                user: existingAuthUser,
                profile: ensureResult.data,
                warning: 'Usuário Auth já existia; perfil recuperado.',
              },
            };
          }

          const message = String((ensureResult.error as any)?.message || 'Erro ao recuperar perfil do secretário');
          return { success: false, error: { message } };
        }

        return { success: false, error: { message: 'E-mail já cadastrado' } };
      }

      if (existingProfile) {
        return { success: false, error: { message: 'E-mail já cadastrado' } };
      }

      let authData: any = null;
      let authError: any = null;

      const createAuthUser = async () => {
        const payload = {
          email: normalizedEmail,
          password,
          email_confirm: userData.emailConfirm !== false,
          user_metadata: authMetadata,
        };

        let result = await authApi.createUser(payload as any);
        if (result.error) {
          const errMsg = String((result.error as any).message || result.error).toLowerCase();
          if (
            errMsg.includes('database error saving new user') ||
            errMsg.includes('database error creating new user') ||
            errMsg.includes('duplicate')
          ) {
            logger.warn('authService.adminCreateUser: fallback creating user without metadata', result.error);
            result = await authApi.createUser({
              email: normalizedEmail,
              password,
              email_confirm: userData.emailConfirm !== false,
            } as any);

            if (result.error) {
              const anonClient = createAnonAuthClient();
              if (anonClient) {
                logger.warn('authService.adminCreateUser: fallback creating user with anon signUp', result.error);
                const signUpResult = await anonClient.auth.signUp({
                  email: normalizedEmail,
                  password,
                  options: {
                    data: authMetadata,
                  },
                });

                result = {
                  data: signUpResult.data,
                  error: signUpResult.error,
                } as any;
              }
            }
          }
        }

        return result;
      };

      const authResult = await createAuthUser();
      authData = authResult.data;
      authError = authResult.error;

      if (authError) {
        let msg = String((authError as any).message || authError || 'Erro ao criar usuário no Auth');
        const lower = msg.toLowerCase();
        if (lower.includes('invalid email')) msg = 'E-mail inválido';
        if (lower.includes('already registered') || lower.includes('user already exists')) msg = 'E-mail já cadastrado';
        if (
          lower.includes('database error saving new user') ||
          lower.includes('database error creating new user') ||
          lower.includes('duplicate')
        ) {
          const authUserExistsAfterError = await findAuthUserByEmail(normalizedEmail);
          if (authUserExistsAfterError) {
            const authUser = authUserExistsAfterError;
            const profileResult = await adminClient
              .from('profiles')
              .select('id')
              .eq('email', normalizedEmail)
              .maybeSingle();

            if (!profileResult.error && !profileResult.data) {
              const ensureResult = await ensureProfileForUser(authUser.id);
              if (ensureResult.success) {
                return {
                  success: true,
                  data: {
                    user: authUser,
                    profile: ensureResult.data,
                    warning: 'Usuário Auth já existia; perfil recuperado.',
                  },
                };
              }
              msg = String((ensureResult.error as any)?.message || msg);
            } else {
              msg = 'E-mail já cadastrado';
            }
          } else if (
            lower.includes('database error saving new user') ||
            lower.includes('database error creating new user')
          ) {
            msg =
              'O Supabase Auth não conseguiu criar o utilizador porque o trigger SQL de criação do profile falhou. Execute o script [docs/SETUP_COMPLETO.sql](/e:/SorrisoDigital/TeOdontoAngola/docs/SETUP_COMPLETO.sql:1) no SQL Editor para recriar a função `handle_new_user` e a tabela `provincias`.';
          }
        }
        logger.error('authService.adminCreateUser: erro ao criar usuário Auth', authError);
        return { success: false, error: { message: msg } };
      }

      if (!authData?.user) {
        return { success: false, error: { message: 'Erro ao criar usuário' } };
      }

      const profilePayload = Object.fromEntries(
        Object.entries({
          id: authData.user.id,
          email: normalizedEmail,
          nome: userData.nome,
          tipo: resolvedType,
          telefone: userData.telefone || null,
          data_nascimento: userData.data_nascimento || null,
          genero: userData.genero || null,
          idade: idadeCalculada ?? null,
          observacoes_gerais: observacoesGerais,
          provincia: PROFILE_SCHEMA_FEATURES.hasProvincia ? userData.provincia || null : undefined,
          provincia_id: PROFILE_SCHEMA_FEATURES.usesProvinciaId ? provinciaId ?? null : undefined,
          senha_alterada: PROFILE_SCHEMA_FEATURES.hasSenhaAlterada ? false : undefined,
          created_at: new Date().toISOString(),
        }).filter(([, value]) => value !== undefined)
      );

      const profileResponse = await upsertProfile(adminClient, profilePayload);
      let profileData: any = profileResponse.data;
      let profileError: any = profileResponse.error;

      if (profileError) {
        if ((profileError as any).code === 'PGRST204') {
          return {
            success: false,
            error: {
              message:
                'Erro de esquema: coluna inexistente na tabela profiles. Execute docs/SUPABASE_SETUP.sql para atualizar o banco de dados.',
            },
          };
        }

        if (isNoRowsError(profileError)) {
          profileData = profilePayload;
          profileError = null;
        } else if (isRowLevelSecurityError(profileError)) {
          const { data: maybeCreatedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          if (maybeCreatedProfile) {
            profileData = {
              ...maybeCreatedProfile,
              nome: maybeCreatedProfile.nome || userData.nome,
              telefone: maybeCreatedProfile.telefone || userData.telefone || null,
              data_nascimento: maybeCreatedProfile.data_nascimento || userData.data_nascimento || null,
              genero: maybeCreatedProfile.genero || userData.genero || null,
              idade: maybeCreatedProfile.idade || idadeCalculada || null,
              provincia: maybeCreatedProfile.provincia || userData.provincia || null,
            };
            profileError = null;
          } else {
            profileData = profilePayload;
            profileError = null;
            warningMessage =
              'Usuário criado no Auth, mas a policy RLS bloqueou escrita em profiles. Execute docs/SUPABASE_SETUP.sql.';
          }
        } else {
          // Rollback do usuário Auth se o perfil não puder ser criado.
          try {
            await adminClient.auth.admin.deleteUser(authData.user.id);
            logger.warn('Rollback: usuário Auth excluído após falha na criação do perfil');
          } catch (rollbackError) {
            logger.error('Rollback falhou ao excluir usuário Auth:', rollbackError);
          }
          const message = String((profileError as any).message || profileError || 'Erro ao criar perfil');
          logger.error('authService.adminCreateUser: erro ao criar perfil', profileError);
          return {
            success: false,
            error: { message },
          };
        }
      }

      const secretario = profileData;

      logger.info('Admin created user successfully');
      return {
        success: true,
        data: { user: authData.user, profile: secretario, warning: warningMessage },
      };
    } catch (error) {
      const handledError = handleError(error, 'authService.adminCreateUser');
      return { success: false, error: handledError };
    }
  },

  adminDeleteUser: async (userId: string): Promise<AuthServiceResult<null>> => {
    try {
      const adminClient = createAdminClient();
      if (!adminClient) {
        return { success: false, error: { message: 'Service role não configurado' } };
      }

      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw deleteAuthError;

      const { error: deleteProfileError } = await adminClient
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (deleteProfileError) throw deleteProfileError;

      return { success: true };
    } catch (error) {
      const handledError = handleError(error, 'authService.adminDeleteUser');
      return { success: false, error: handledError };
    }
  },

  /**
   * Fazer logout
   */
  signOut: async (): Promise<AuthServiceResult<null>> => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      logger.info('User signed out successfully');
      return { success: true };
    } catch (error) {
      const handledError = handleError(error, 'authService.signOut');
      return { success: false, error: handledError };
    }
  },

  /**
   * Recuperar password
   */
  resetPassword: async (email: string): Promise<AuthServiceResult<null>> => {
    try {
      if (!validators.isValidEmail(email)) {
        return {
          success: false,
          error: { message: 'Email inválido' },
        };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://teodontoangola.app/reset-password',
      });

      if (error) throw error;

      logger.info('Password reset email sent');
      return { success: true };
    } catch (error) {
      const handledError = handleError(error, 'authService.resetPassword');
      return { success: false, error: handledError };
    }
  },

  /**
   * Obter sessão atual
   */
  getSession: async (): Promise<AuthServiceResult<AuthSession | null>> => {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      return { success: true, data: data.session };
    } catch (error) {
      const handledError = handleError(error, 'authService.getSession');
      return { success: false, error: handledError };
    }
  },

  /**
   * Escutar mudanças de estado de autenticação
   */
  onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      callback(event, session);
    });

    return subscription;
  },
};

export default authService;
