/**
 * Serviço de Autenticação
 * Centraliza toda a lógica de autenticação
 */

import { AuthSession } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
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
}

export interface AuthServiceResult<T> {
  success: boolean;
  data?: T;
  error?: HandledError | { message: string };
}

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
