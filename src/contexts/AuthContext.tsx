/**
 * Auth Context
 * Gerencia o estado de autenticação global da aplicação
 */

import React, { createContext, useState, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';
import { universalStorage } from '../utils/storage';
import { supabase, PROFILE_SCHEMA_FEATURES, SUPABASE_URL } from '../config/supabase';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { handleError, HandledError } from '../utils/errorHandler';

const AUTH_BOOT_TIMEOUT_MS = 10000;
const AUTH_NETWORK_TIMEOUT_MS = 5000;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inactividade

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
  const [isSigningIn, setIsSigningInState] = useState<boolean>(false);
  const [lastLoginTime, setLastLoginTimeState] = useState<number>(0);

  // Refs para evitar problemas de closure no onAuthStateChange/fetchProfile
  const isSigningInRef = React.useRef(false);
  const lastLoginTimeRef = React.useRef(0);

  const setIsSigningIn = (val: boolean) => {
    isSigningInRef.current = val;
    setIsSigningInState(val);
  };

  const setLastLoginTime = (val: number) => {
    lastLoginTimeRef.current = val;
    setLastLoginTimeState(val);
  };



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
    const extra = Constants.expoConfig?.extra || (Constants as any).manifest2?.extra || (Constants as any).manifest?.extra;
    const url = extra?.SUPABASE_URL;
    const key = extra?.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn('⚠️ getAdminClient: Admin keys missing in Constants.extra');
      return null;
    }

    return createClient(url, key, {
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

  const checkSupabaseReachable = async (): Promise<boolean> => {
    if (!SUPABASE_URL) return false;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const controller =
        typeof AbortController !== 'undefined' ? new AbortController() : undefined;

      timeoutId = setTimeout(() => controller?.abort(), AUTH_NETWORK_TIMEOUT_MS);

      const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: 'GET',
        signal: controller?.signal,
        headers: {
          apikey: String(Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || ''),
        },
      });

      return response.ok;
    } catch (error) {
      logger.warn('Supabase indisponivel na verificacao de conectividade:', error);
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const validarPerfilPorEmail = async (
    email: string
  ): Promise<{ exists: boolean; tipo?: string; nome?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();

    let result = await supabase
      .from('profiles')
      .select('id, nome, tipo')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if ((!result.data || result.error) && getAdminClientFromContext()) {
      const admin = getAdminClientFromContext();
      if (admin) {
        result = await admin
          .from('profiles')
          .select('id, nome, tipo')
          .eq('email', normalizedEmail)
          .maybeSingle();
      }
    }

    if (!result.data) {
      return { exists: false };
    }

    return {
      exists: true,
      tipo: result.data.tipo,
      nome: result.data.nome,
    };
  };

  const normalizeProfile = (rawProfile: any): UserProfile => {
    if (!rawProfile) return rawProfile as UserProfile;

    const normalizedTipo = rawProfile.tipo === 'medico' ? 'dentista' : rawProfile.tipo;
    const observacoesGerais = String(rawProfile.observacoes_gerais || '');
    const dataNascimentoExtraida =
      rawProfile.data_nascimento ||
      observacoesGerais.match(/\[DN\]: ([^ [\]\n]+)/)?.[1] ||
      undefined;
    const generoExtraido =
      rawProfile.genero ||
      observacoesGerais.match(/\[G\]: ([^ [\]\n]+)/)?.[1] ||
      undefined;
    const idadeExtraidaRaw =
      rawProfile.idade ??
      observacoesGerais.match(/\[IDADE\]: (\d{1,3})/)?.[1];
    const idadeExtraida =
      idadeExtraidaRaw !== undefined && idadeExtraidaRaw !== null && !Number.isNaN(Number(idadeExtraidaRaw))
        ? Number(idadeExtraidaRaw)
        : undefined;

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
        data_nascimento: dataNascimentoExtraida,
        genero: generoExtraido,
        idade: idadeExtraida,
      } as UserProfile;
    }

    return {
      ...rawProfile,
      tipo: normalizedTipo,
      data_nascimento: dataNascimentoExtraida,
      genero: generoExtraido,
      idade: idadeExtraida,
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

  const handleForceLogout = async (userId: string, message: string) => {
    setUser(null);
    setProfile(null);
    await universalStorage.removeItem(`last_session_id_${userId}`);
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('SignOut local error (ignorado):', e);
    }

    Toast.show({
      type: 'info',
      text1: 'Sessão Encerrada',
      text2: message,
      visibilityTime: 7000,
    });
  };

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
      const delta = Date.now() - lastLoginTimeRef.current;
      const isRecentlyLoggedIn = delta < 3000; // REDUCIDO: 3 segundos de carência para evitar falsos positivos de rede
      
      if (!isSigningInRef.current && !isRecentlyLoggedIn && data.last_session_id && localSessionId && data.last_session_id !== localSessionId) {
        console.warn(`🚨 Login: Session Mismatch for ${userId}. DB: ${data.last_session_id}, Local: ${localSessionId}`);
        
        // Se houver conflito, damos uma segunda chance rápida
        await new Promise(r => setTimeout(r, 1000));
        const { data: retryData } = await supabase.from('profiles').select('last_session_id').eq('id', userId).maybeSingle();
        
        if (retryData?.last_session_id && retryData.last_session_id !== localSessionId) {
          logger.warn(`Sessao conflitante confirmada para ${userId}. Local: ${localSessionId}, DB: ${retryData.last_session_id}. Expulsando.`);
          await handleForceLogout(userId, 'Esta conta foi ligada noutro dispositivo.');
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
    let bootstrapReleased = false;
    const bootTimeout = setTimeout(() => {
      logger.warn(`Auth bootstrap excedeu ${AUTH_BOOT_TIMEOUT_MS}ms. Liberando app com fallback.`);
      setInitializing(false);
      setLoading(false);
    }, AUTH_BOOT_TIMEOUT_MS);

    const releaseBootstrap = () => {
      if (bootstrapReleased) return;
      bootstrapReleased = true;
      clearTimeout(bootTimeout);
      setInitializing(false);
      setLoading(false);
    };

    // Verificar sessÃ£o atual e FORÃAR LOGOUT SE ENCONTRAR (Logout on Reload)
    void checkSupabaseReachable().then((reachable) => {
      if (!reachable) {
        logger.warn('Bootstrap: Supabase indisponivel, seguindo sem sessao inicial.');
        releaseBootstrap();
      }
    });

    withTimeout(supabase.auth.getSession(), AUTH_BOOT_TIMEOUT_MS)
      .then(({ data: { session } }) => {
        if (session?.user) {
          console.log(`📡 Bootstrap: Recovered session for ${session.user.id}.`);
          setLastLoginTime(Date.now()); // Inicializa tempo no boot
          void fetchProfile(session.user.id).finally(() => {
            releaseBootstrap();
          });
          return;
        }
        releaseBootstrap();
      })
      .catch((error) => {
        console.warn('⚠️ Bootstrap: Falha ao obter sessao inicial:', error);
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

  // ═══════════════════════════════════════════════════════════
  // SINGLE-SESSION REALTIME LISTENER
  // Detects when another device logs in and overrides the session
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;
    let sessionChannel: any = null;

    const setupSessionListener = async () => {
      const localSessionId = await universalStorage.getItem(`last_session_id_${userId}`);
      if (!localSessionId) return;

      sessionChannel = supabase.channel(`session-guard-${userId}`);

      // 1. Escutar alterações no banco (Postgres Changes) - Fallback lento mas persistente
      sessionChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        async (payload: any) => {
          const newSessionIdInDB = payload.new?.last_session_id;
          const currentLocalId = await universalStorage.getItem(`last_session_id_${userId}`);

          if (newSessionIdInDB && currentLocalId && newSessionIdInDB !== currentLocalId) {
            console.warn(`🚨 Realtime DB: Session mismatch! DB: ${newSessionIdInDB}, Local: ${currentLocalId}. Expulsando.`);
            handleForceLogout(userId, 'Sessão Encerrada: A sua conta foi acedida noutro dispositivo.');
          }
        }
      );

      // 2. Escutar Broadcast (Imediato) - Ultra rápido para dispositivos online
      sessionChannel.on('broadcast', { event: 'SESSION_CHANGE' }, async (payload: any) => {
        const receivedSessionId = payload.payload?.sessionId;
        const currentLocalId = await universalStorage.getItem(`last_session_id_${userId}`);

        if (receivedSessionId && currentLocalId && receivedSessionId !== currentLocalId) {
          console.warn(`🚨 Broadcast: New session detected! New: ${receivedSessionId}, current: ${currentLocalId}. Expulsando.`);
          handleForceLogout(userId, 'Sessão Encerrada: Novo login detetado em outro dispositivo.');
        }
      });

      sessionChannel.subscribe((status: string) => {
        console.log(`📡 Session guard channel status [${userId}]: ${status}`);
      });
    };

    setupSessionListener();

    return () => {
      if (sessionChannel) {
        supabase.removeChannel(sessionChannel);
      }
    };
  }, [user?.id]);

  // ═══════════════════════════════════════════════════════════
  // 5-SECOND SESSION HEARTBEAT (FAIL-SAFE)
  // Re-verifies session integrity every 5 seconds as a fallback
  // for Realtime failures (e.g. poor connection)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const verifySessionIntegrity = async () => {
      try {
        const localSessionId = currentInstanceSessionId.current;
        if (!localSessionId) {
          // Fallback se o ref estiver vazio (e.g. apos recarregar aba mas storage ainda tem)
          const storedId = await universalStorage.getItem(`last_session_id_${userId}`);
          if (!storedId) return;
          currentInstanceSessionId.current = storedId;
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('last_session_id')
          .eq('id', userId)
          .maybeSingle();

        if (error) return;

        if (data?.last_session_id && data.last_session_id !== localSessionId) {
          console.warn(`🚨 Heartbeat Discordancia: DB=${data.last_session_id}, Local=${localSessionId}`);
          await handleForceLogout(userId, 'Sessão Encerrada: A sua conta foi aberta em outro local.');
        }
      } catch (err) {
        // Heartbeat failure is usually network related, ignore
      }
    };

    // Executar a cada 3 segundos para garantir a regra de "no maximo 5s"
    const interval = setInterval(() => {
      // REMOVIDO: verificamos mesmo em background/hidden para forçar logout
      verifySessionIntegrity();
    }, 3000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // ═══════════════════════════════════════════════════════════
  // SESSION VERIFICATION ON FOCUS
  // Re-verify session ID when user returns to app
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user?.id) return;

    const handleFocus = () => {
      console.log('📡 Focus: Re-verifying session ID...');
      fetchProfile(user.id);
    };

    if (Platform.OS === 'web') {
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') handleFocus();
      });
      return () => sub.remove();
    }
  }, [user?.id]);

  // ═══════════════════════════════════════════════════════════
  // INACTIVITY TIMEOUT (5 MINUTOS)
  // Auto-logout após 5 minutos sem actividade (Todos os usuários)
  // ═══════════════════════════════════════════════════════════
  const inactivityTimer = useRef<any>(null);
  const backgroundTimestamp = useRef<number | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (!user) return; // Aplica a todos os usuários logados

    inactivityTimer.current = setTimeout(async () => {
      console.warn('⏰ Inactividade: 5 minutos sem actividade. Logout automático.');
      
      Toast.show({
        type: 'info',
        text1: 'Sessão Expirada',
        text2: 'Logout automático por inactividade (5 min).',
        visibilityTime: 5000,
      });

      try {
        await signOut();
      } catch (e) {
        setUser(null);
        setProfile(null);
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      return;
    }

    // Iniciar timer
    resetInactivityTimer();

    if (Platform.OS === 'web') {
      // Web/PWA: escutar eventos de actividade
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
      const handler = () => resetInactivityTimer();
      events.forEach(e => window.addEventListener(e, handler, { passive: true }));

      return () => {
        events.forEach(e => window.removeEventListener(e, handler));
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    } else {
      // Mobile: usar AppState para detectar background
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'background' || nextState === 'inactive') {
          backgroundTimestamp.current = Date.now();
        } else if (nextState === 'active') {
          if (backgroundTimestamp.current) {
            const elapsed = Date.now() - backgroundTimestamp.current;
            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
              // Esteve em background por 5+ minutos
              console.warn('⏰ Mobile: App em background por 5+ min. Logout automático.');
              Toast.show({
                type: 'info',
                text1: 'Sessão Expirada',
                text2: 'Logout automático por inactividade.',
                visibilityTime: 5000,
              });
              signOut().catch(() => { setUser(null); setProfile(null); });
            }
            backgroundTimestamp.current = null;
          }
          resetInactivityTimer();
        }
      });

      return () => {
        subscription.remove();
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      };
    }
  }, [user, resetInactivityTimer]);

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
      const isReachable = await checkSupabaseReachable();
      if (!isReachable) {
        throw new Error('Servidor de autenticacao indisponivel. Verifique a internet e tente novamente.');
      }

      console.log(`📡 Login: Starting signInWithPassword for ${email}`);
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        }),
        20000 // 20s timeout for auth
      );

      if (error) throw error;

      if (data.user) {
        console.log(`🔐 Login: Authenticated ${data.user.email} (${data.user.id})`);
        
        // Encerra outras sessoes no Supabase Auth (Não bloqueante)
        console.log('📡 Login: Invaliding other sessions (non-blocking)...');
        void supabase.auth.signOut({ scope: 'others' }).catch(err => {
          console.warn('⚠️ Login: signOut(others) failed (ignoring):', err);
        });
        
        // Registrar nova sessao para esta instancia
        const newSessionId = generateSessionId();
        const userId = data.user.id;
        currentInstanceSessionId.current = newSessionId; // Vincular esta aba ao novo ID
        lastLoginTimeRef.current = Date.now();
        
        console.log(`📡 Login: New Instance Session ID: ${newSessionId}`);
        await universalStorage.setItem(`last_session_id_${userId}`, newSessionId);
        
        const runSessionUpdate = async () => {
          console.log('📡 Login: Upserting session ID to DB...');
          try {
            // Tentamos upsert para garantir que o registro existe e tem o ID
            const { error: upsertError } = await supabase
              .from('profiles')
              .upsert({ 
                id: userId, 
                last_session_id: newSessionId,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' });
            
            if (upsertError) throw upsertError;
            return { error: null };
          } catch (err) {
            console.error('❌ Login: Failed to upsert session ID:', err);
            return { error: err };
          }
        };

        const updateResult = await runSessionUpdate();
        if (updateResult.error) {
          console.error('❌ Login: Falha crítica ao atualizar last_session_id:', updateResult.error);
        } else {
          console.log('✅ Login: Session ID updated in DB successfully.');
          
          // BROADCAST IMEDIATO para outros dispositivos encerrarem sessao
          console.log('📡 Login: Broadcasting session change to others...');
          const channel = supabase.channel(`session-guard-${userId}`);
          channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await channel.send({
                type: 'broadcast',
                event: 'SESSION_CHANGE',
                payload: { sessionId: newSessionId },
              });
              console.log('✅ Login: Broadcast sent.');
              // Remover canal temporário de login
              setTimeout(() => supabase.removeChannel(channel), 2000);
            }
          });
        }
      }

      logger.info('Utilizador fez login com sucesso');
      return { success: true, data };
    } catch (error) {
      let handledError = handleError(error, 'AuthProvider.signIn');

      const rawMessage = String((error as any)?.message || '').toLowerCase();
      if (rawMessage.includes('invalid login credentials')) {
        handledError = {
          ...handledError,
          type: 'AUTH_ERROR' as any,
          message: 'Email ou senha incorretos. Verifique os dados e tente novamente.',
        };
      }

      Toast.show({
        type: 'error',
        text1: 'Erro no login',
        text2: handledError.message,
      });
      logger.error('Erro no login:', handledError);
      return { success: false, error: handledError };
    } finally {
      setLoading(false);
      // Aumentado para 15s para garantir que fetchProfile corra em paz no Web
      setTimeout(() => {
        console.log('📡 Login: isSigningIn grace period expired.');
        setIsSigningIn(false);
      }, 15000);
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

      const userId = user?.id;

      // 1) encerra sessao local imediatamente
      if (userId) {
        console.log(`🚪 SignOut: Initiating global signout for ${userId}`);
        await universalStorage.removeItem(`last_session_id_${userId}`);
        
        // Tenta limpar ID de sessao no banco (admin fallback se necessario)
        const runSessionCleanup = async () => {
          let res = await supabase.from('profiles').update({ last_session_id: null }).eq('id', userId);
          if (res.error && isRowLevelSecurityError(res.error)) {
            const admin = getAdminClientFromContext();
            if (admin) res = await admin.from('profiles').update({ last_session_id: null }).eq('id', userId);
          }
          return res;
        };
        void runSessionCleanup();
      }

      setUser(null);
      setProfile(null);

      Toast.show({
        type: 'success',
        text1: 'Sessao terminada',
        text2: 'Terminou sessao em todos os dispositivos',
      });

      // 2) tenta logout remoto GLOBAL sem bloquear a navegacao
      void supabase.auth
        .signOut({ scope: 'global' }) // Invalida todas as sessoes em todos os dispositivos
        .then(({ error }) => {
          if (error) {
            remoteSignOutError = error;
            logger.warn('Logout global falhou, mantendo logout local:', remoteSignOutError);
          } else {
            console.log('✅ SignOut: Global signout success');
          }
        })
        .catch((error: unknown) => {
          remoteSignOutError = error;
          logger.warn('Falha inesperada no logout global:', remoteSignOutError);
        });
    } catch (error: unknown) {
      const handledError = handleError(error, 'AuthProvider.signOut');
      logger.error('Erro ao fazer logout:', handledError);
      setUser(null);
      setProfile(null);
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
