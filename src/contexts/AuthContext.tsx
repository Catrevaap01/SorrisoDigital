/**
 * Auth Context
 * Gerencia o estado de autenticação global da aplicação
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';
import { universalStorage } from '../utils/storage';
import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { handleError, HandledError } from '../utils/errorHandler';

const AUTH_BOOT_TIMEOUT_MS = 30000;

export interface UserProfile {
  id: string;
  email?: string;
  nome?: string;
  tipo?: 'paciente' | 'dentista' | 'medico' | 'admin';
  telefone?: string;
  provincia?: string;
  provincia_id?: number;
  // Campos adicionais usados para dentistas
  crm?: string;
  numero_registro?: string;
  especialidade?: string;
  foto_url?: string;
  senha_alterada?: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; data?: any; error?: HandledError }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; data?: any; error?: HandledError }>;
  signUp: (email: string, password: string, userData: Omit<UserProfile, 'id' | 'email'>) => Promise<{ success: boolean; data?: any; error?: HandledError }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; data?: UserProfile; error?: HandledError }>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [lastLoginTime, setLastLoginTime] = useState<number>(0);



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

  const getProvinciaNameFromId = (id?: number): string | undefined => {
    if (!id || id < 1 || id > PROVINCIAS_STATIC_ORDER.length) return undefined;
    return PROVINCIAS_STATIC_ORDER[id - 1];
  };

  // Helper from pacienteService (copied for RLS fallback)
  const getAdminClient = (): SupabaseClient | null => {
    const extra = Constants.expoConfig?.extra;
    const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
    const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  };

  const isRowLevelSecurityError = (error: any): boolean => {
    const msg = String(error?.message || '').toLowerCase();
    return (
      error?.code === '42501' ||
      msg.includes('row-level security') ||
      msg.includes('violates row-level security')
    );
  };

  const getAdminClientFromContext = () => getAdminClient();

  const normalizeProfile = (rawProfile: any): UserProfile => {
    if (!rawProfile) return rawProfile as UserProfile;

    const normalizedTipo = rawProfile.tipo === 'medico' ? 'dentista' : rawProfile.tipo;

    if (PROFILE_SCHEMA_FEATURES.usesProvinciaId) {
      const provinciaNome =
        rawProfile.provincia ??
        rawProfile.provincias?.nome ??
        rawProfile.provincias?.[0]?.nome ??
        getProvinciaNameFromId(rawProfile.provincia_id);

      return {
        ...rawProfile,
        tipo: normalizedTipo,
        provincia: provinciaNome,
      } as UserProfile;
    }

    return {
      ...rawProfile,
      tipo: normalizedTipo,
    } as UserProfile;
  };

  const normalizeText = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

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
      (prov) => canonicalizeProvinciaName(prov) === target
    );
    return index >= 0 ? index + 1 : undefined;
  };

  const resolveProvinciaId = async (nomeProvincia?: string): Promise<number | undefined> => {
    const provinciaNome = nomeProvincia?.trim();

    if (!PROFILE_SCHEMA_FEATURES.usesProvinciaId || !provinciaNome) {
      return undefined;
    }

    // 1) tentativa direta (mais rápida)
    const { data: exactData, error: exactError } = await supabase
      .from('provincias')
      .select('id')
      .eq('nome', provinciaNome)
      .single();

    if (!exactError && exactData?.id) {
      return exactData.id;
    }

    // 2) tentativa case-insensitive
    const { data: ilikeData, error: ilikeError } = await supabase
      .from('provincias')
      .select('id, nome')
      .ilike('nome', provinciaNome)
      .limit(1)
      .maybeSingle();

    if (!ilikeError && ilikeData?.id) {
      return ilikeData.id;
    }

    // 3) fallback tolerante a acentos (client-side)
    const { data: allProvincias, error: allError } = await supabase
      .from('provincias')
      .select('id, nome');

    if (allError) {
      logger.warn('Nao foi possivel resolver provincia_id por nome:', allError);
      return resolveProvinciaIdFromStaticList(provinciaNome);
    }

    const target = canonicalizeProvinciaName(provinciaNome);
    const matched = (allProvincias || []).find(
      (p: any) => canonicalizeProvinciaName(p.nome) === target
    );

    if (!matched) {
      const staticId = resolveProvinciaIdFromStaticList(provinciaNome);
      if (staticId) {
        return staticId;
      }
logger.warn('Província não encontrada para nome informado:', provinciaNome);
    }

    return matched?.id;
  };

  const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  /**
   * Buscar perfil do usuÃ¡rio
   */
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const selectQuery = PROFILE_SCHEMA_FEATURES.usesProvinciaId
        ? '*, provincias(nome)'
        : '*';

      // use maybeSingle to avoid throwing when não há linhas
      let { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select(selectQuery)
          .eq('id', userId)
          .maybeSingle(),
        AUTH_BOOT_TIMEOUT_MS
      );

      // Fallback for RLS/blocked/recursion 500 errors: try admin client
      if (error && (isRowLevelSecurityError(error) || (error as any).status === 500 || (error as any).code === '500')) {
        logger.warn(`RLS or 500 error in fetchProfile for ${userId}, trying admin fallback`, error);
        const adminClient = getAdminClientFromContext();
        if (adminClient) {
          ({ data, error } = await withTimeout(
            adminClient
              .from('profiles')
              .select(selectQuery)
              .eq('id', userId)
              .maybeSingle(),
            5000
          ));
        }
      }

      if (error) throw error;

      if (!data) {
        // perfil ausente; pode ocorrer se o usuário foi criado fora do fluxo
        // normal (e.g. script de admin). tentamos criar uma linha mínima para
        // evitar erros subsequentes e respeitar o contrato da aplicação.
        logger.warn(`Perfil não encontrado para ${userId}, criando entrada vazia`);
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const userMeta = userRes?.user?.user_metadata || {};
          const payload: any = {
            id: userId,
            email: userRes?.user?.email || null,
            nome: userMeta.nome || null,
            tipo: userMeta.tipo || 'paciente',
            created_at: new Date().toISOString(),
          };
          await supabase.from('profiles').insert([payload]);
          const normalized = normalizeProfile(payload);
          setProfile(normalized);
          return normalized;
        } catch (createErr) {
          logger.error('Erro ao criar perfil padrão:', createErr);
          return null;
        }
      }

      const normalizedProfile = normalizeProfile(data);
      
      // LOGICA SINGLE DEVICE: Verificar se a sessao local coincide com a do banco
      const localSessionId = await universalStorage.getItem(`last_session_id_${userId}`);
      const isRecentlyLoggedIn = Date.now() - lastLoginTime < 30000; // 30 segundos de carência
      
      if (!isSigningIn && !isRecentlyLoggedIn && data.last_session_id && localSessionId && data.last_session_id !== localSessionId) {
        // Se houver conflito, damos uma segunda chance (pode ser delay de propagação do Supabase)
        logger.warn(`Possível conflito de sessão para ${userId}. Aguardando 2s para re-verificação...`);
        await new Promise(r => setTimeout(r, 2000));
        const { data: retryData } = await supabase.from('profiles').select('last_session_id').eq('id', userId).maybeSingle();
        
        if (retryData?.last_session_id && retryData.last_session_id !== localSessionId) {
          logger.warn(`Sessao conflitante CONFIRMADA para ${userId}. Local: ${localSessionId}, DB: ${retryData.last_session_id}. Forçando logout.`);
          // Nao chamamos signOut direto para evitar loop, limpamos e avisamos
        setUser(null);
        setProfile(null);
        await universalStorage.removeItem(`last_session_id_${userId}`);
        await supabase.auth.signOut();
        Toast.show({
          type: 'info',
          text1: 'SessÃ£o Encerrada',
          text2: 'Esta conta foi ligada noutro dispositivo.',
          visibilityTime: 6000,
        });
          return null;
        }
      }

      setProfile(normalizedProfile);
      logger.info('Perfil do usuÃ¡rio carregado com sucesso');
      return normalizedProfile;
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.fetchProfile');
      // apenas log de aviso se for ausência de linha, já tratado acima
      logger.error('Erro ao buscar perfil:', handledError);
      return null;
    }
  };

  /**
   * Escutar mudanÃ§as de autenticaÃ§Ã£o
   */
  useEffect(() => {
    const bootTimeout = setTimeout(() => {
      logger.warn(`Auth bootstrap excedeu ${AUTH_BOOT_TIMEOUT_MS}ms. Liberando app com fallback.`);
      setInitializing(false);
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    // Verificar sessÃ£o atual
    withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS)
      .then(({ data: { session } }) => {
        if (session?.user) {
          setLastLoginTime(Date.now()); // Inicializa tempo no boot
          void fetchProfile(session.user.id).finally(() => {
            setInitializing(false);
            setLoading(false);
          });
          return;
        }
        setInitializing(false);
        setLoading(false);
      })
      .catch((error) => {
        logger.warn('Falha/timeout ao obter sessao inicial:', error);
        setInitializing(false);
        setLoading(false);
      });

    // Escutar mudanÃ§as de estado de autenticaÃ§Ã£o
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      clearTimeout(bootTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * FunÃ§Ã£o de login
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; data?: any; error?: HandledError }> => {
    try {
      setLoading(true);
      setIsSigningIn(true);
      setLastLoginTime(Date.now());

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Encerra outras sessoes no Supabase Auth
        await supabase.auth.signOut({ scope: 'others' });
        
        // Registrar nova sessao
        const newSessionId = generateSessionId();
        await universalStorage.setItem(`last_session_id_${data.user.id}`, newSessionId);
        await supabase.from('profiles').update({ last_session_id: newSessionId }).eq('id', data.user.id);
      }

      logger.info('Utilizador fez login com sucesso');
      return { success: true, data };
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.signIn');
      Toast.show({
        type: 'error',
        text1: 'Erro no login',
        text2: handledError.message,
      });
      logger.error('Erro no login:', handledError);
      return { success: false, error: handledError };
    } finally {
      setLoading(false);
      // Aguarda um pouco mais para que o observer de auth state processe o novo session_id
      setTimeout(() => setIsSigningIn(false), 5000);
    }
  };

  /**
   * FunÃ§Ã£o de registro
   */
  const signUp = async (
    email: string,
    password: string,
    userData: Omit<UserProfile, 'id' | 'email'>
  ): Promise<{ success: boolean; data?: any; error?: HandledError }> => {
    try {
      setLoading(true);
      setIsSigningIn(true);
      setLastLoginTime(Date.now());

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            nome: userData.nome,
            tipo: userData.tipo || 'paciente',
          },
        },
      });

      if (error) throw error;

      // Atualizar perfil com dados adicionais
      if (data.user) {
        const provinciaId = await resolveProvinciaId(userData.provincia);

        // Registrar sessao inicial
        const newSessionId = generateSessionId();
        await universalStorage.setItem(`last_session_id_${data.user.id}`, newSessionId);

        const profileUpdates = Object.fromEntries(
          Object.entries({
            telefone: userData.telefone,
            provincia: PROFILE_SCHEMA_FEATURES.hasProvincia ? userData.provincia : undefined,
            provincia_id: PROFILE_SCHEMA_FEATURES.usesProvinciaId ? provinciaId : undefined,
            last_session_id: newSessionId,
          }).filter(([, value]) => value !== undefined)
        );

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', data.user.id);

        if (profileError) {
          logger.warn('Erro ao atualizar perfil apÃ³s signup:', profileError);
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Conta criada!',
        text2: 'Bem-vindo ao TeOdonto Angola',
      });

      logger.info('Novo utilizador registado com sucesso');
      return { success: true, data };
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.signUp');
      Toast.show({
        type: 'error',
        text1: 'Erro no cadastro',
        text2: handledError.message,
      });
      logger.error('Erro no signup:', handledError);
      return { success: false, error: handledError };
    } finally {
      setLoading(false);
      setTimeout(() => setIsSigningIn(false), 5000);
    }
  };

  /**
   * FunÃ§Ã£o de logout
   */
  const signOut = async (): Promise<void> => {
    // Logout deve ser instantaneo na UI: encerra sessao local primeiro
    // e tenta finalizar sessao remota em background.
    let remoteSignOutError: unknown = null;
    try {
      setLoading(true);

      // 1) encerra sessao local imediatamente
      if (user) {
        await universalStorage.removeItem(`last_session_id_${user.id}`);
      }
      setUser(null);
      setProfile(null);

      Toast.show({
        type: 'success',
        text1: 'Sessao terminada',
        text2: 'Terminou sessao com sucesso',
      });

      // 2) tenta logout remoto sem bloquear a navegacao
      void supabase.auth
        .signOut()
        .then(({ error }) => {
          if (error) {
            remoteSignOutError = error;
            logger.warn('Logout remoto falhou, mantendo logout local:', remoteSignOutError);
          } else {
            logger.info('Utilizador desconectado com sucesso');
          }
        })
        .catch((error: unknown) => {
          remoteSignOutError = error;
          logger.warn('Falha inesperada no logout remoto, mantendo logout local:', remoteSignOutError);
        });
    } catch (error: unknown) {
      const handledError = handleError(error, 'AuthProvider.signOut');
      logger.error('Erro ao fazer logout:', handledError);
      // fallback final para não prender o usuário logado na UI
      setUser(null);
      setProfile(null);
      Toast.show({
        type: 'info',
        text1: 'Sessao local terminada',
        text2: 'Falha no logout remoto, mas voce saiu deste dispositivo',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualizar perfil do usuÃ¡rio
   */
  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; data?: UserProfile; error?: HandledError }> => {
    try {
      setLoading(true);

      if (!user) {
        throw new Error('UsuÃ¡rio nÃ£o autenticado');
      }

      const provinciaId = await resolveProvinciaId(updates.provincia);
      const wantsProvinciaUpdate =
        typeof updates.provincia === 'string' && updates.provincia.trim().length > 0;

      if (
        PROFILE_SCHEMA_FEATURES.usesProvinciaId &&
        wantsProvinciaUpdate &&
        provinciaId === undefined
      ) {
        throw new Error('Provincia invalida. Use uma provincia de Angola reconhecida.');
      }

      const payload = {
        ...updates,
        provincia: PROFILE_SCHEMA_FEATURES.hasProvincia ? updates.provincia : undefined,
        provincia_id: PROFILE_SCHEMA_FEATURES.usesProvinciaId ? provinciaId : undefined,
      };

      if (PROFILE_SCHEMA_FEATURES.usesProvinciaId) {
        delete payload.provincia;
      }

      const canUpdateUpdatedAt =
        !!profile && Object.prototype.hasOwnProperty.call(profile, 'updated_at');

      const sanitizedUpdates = Object.fromEntries(
        Object.entries({
          ...payload,
          updated_at: canUpdateUpdatedAt ? new Date().toISOString() : undefined,
        }).filter(([, value]) => value !== undefined)
      );
      const updateKeys = Object.keys(sanitizedUpdates);
      const shouldSkipSelect =
        updateKeys.length > 0 &&
        updateKeys.every((key) => key === 'senha_alterada' || key === 'updated_at');

      const runUpdate = async (updatePayload: Record<string, any>) => {
        if (shouldSkipSelect) {
          return await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', user.id);
        }

        const selectQuery = PROFILE_SCHEMA_FEATURES.usesProvinciaId
          ? '*, provincias(nome)'
          : '*';

        return await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', user.id)
          .select(selectQuery)
          .single();
      };

      let currentPayload = { ...sanitizedUpdates };
      let { data, error } = await runUpdate(currentPayload);

      while (error && (error as any).code === 'PGRST204') {
        const missingColumnMatch = (error as any).message?.match(/'([^']+)' column/);
        const missingColumn = missingColumnMatch?.[1];

        if (!missingColumn || !(missingColumn in currentPayload)) {
          break;
        }

        const { [missingColumn]: _, ...fallbackPayload } = currentPayload;
        currentPayload = fallbackPayload;
        ({ data, error } = await runUpdate(currentPayload));

        if (!error) {
          logger.warn(
            `Coluna ausente no schema de profiles ignorada no updateProfile: ${missingColumn}`
          );
        }
      }

      if (error) throw error;

      const normalizedProfile = shouldSkipSelect
        ? ({
            ...(profile || {}),
            ...updates,
            updated_at: currentPayload.updated_at,
          } as UserProfile)
        : normalizeProfile(data);
      setProfile(normalizedProfile);

      Toast.show({
        type: 'success',
        text1: 'Perfil atualizado!',
      });

      logger.info('Perfil do utilizador atualizado');
      return { success: true, data: normalizedProfile };
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.updateProfile');
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: handledError.message,
      });
      logger.error('Erro ao atualizar perfil:', handledError);
      return { success: false, error: handledError };
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (user) {
      return await fetchProfile(user.id);
    }
    return null;
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    initializing,
    login: signIn, // Alias para signIn
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
