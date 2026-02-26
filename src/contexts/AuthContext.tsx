/**
 * Auth Context
 * Gerencia o estado de autenticação global da aplicação
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User, AuthSession } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { handleError, HandledError } from '../utils/errorHandler';

export interface UserProfile {
  id: string;
  email?: string;
  nome?: string;
  tipo?: 'paciente' | 'dentista' | 'admin';
  telefone?: string;
  provincia?: string;
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

  /**
   * Buscar perfil do usuário
   */
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setProfile(data as UserProfile);
      logger.info('Perfil do usuário carregado com sucesso');
      return data as UserProfile;
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.fetchProfile');
      logger.error('Erro ao buscar perfil:', handledError);
      return null;
    }
  };

  /**
   * Escutar mudanças de autenticação
   */
  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setInitializing(false);
    });

    // Escutar mudanças de estado de autenticação
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

    return () => subscription?.unsubscribe();
  }, []);

  /**
   * Função de login
   */
  const signIn = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; data?: any; error?: HandledError }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Bem-vindo!',
        text2: 'Login realizado com sucesso',
      });

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
    }
  };

  /**
   * Função de registro
   */
  const signUp = async (
    email: string,
    password: string,
    userData: Omit<UserProfile, 'id' | 'email'>
  ): Promise<{ success: boolean; data?: any; error?: HandledError }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
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
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            telefone: userData.telefone,
            provincia: userData.provincia,
          })
          .eq('id', data.user.id);

        if (profileError) {
          logger.warn('Erro ao atualizar perfil após signup:', profileError);
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
    }
  };

  /**
   * Função de logout
   */
  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setUser(null);
      setProfile(null);

      Toast.show({
        type: 'success',
        text1: 'Até logo!',
        text2: 'Você saiu da sua conta',
      });

      logger.info('Utilizador desconectado com sucesso');
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.signOut');
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível sair',
      });
      logger.error('Erro ao fazer logout:', handledError);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Atualizar perfil do usuário
   */
  const updateProfile = async (
    updates: Partial<UserProfile>
  ): Promise<{ success: boolean; data?: UserProfile; error?: HandledError }> => {
    try {
      setLoading(true);

      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data as UserProfile);

      Toast.show({
        type: 'success',
        text1: 'Perfil atualizado!',
      });

      logger.info('Perfil do utilizador atualizado');
      return { success: true, data: data as UserProfile };
    } catch (error) {
      const handledError = handleError(error, 'AuthProvider.updateProfile');
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Não foi possível atualizar o perfil',
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
