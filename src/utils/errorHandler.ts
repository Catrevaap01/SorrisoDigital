/**
 * Tratamento centralizado de erros
 * Mapeia erros da API para mensagens amigáveis ao utilizador
 */

import { logger } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  AUTH = 'AUTH_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  SERVER = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

export const ERROR_TYPES = {
  NETWORK: ErrorType.NETWORK,
  VALIDATION: ErrorType.VALIDATION,
  AUTH: ErrorType.AUTH,
  AUTHORIZATION: ErrorType.AUTHORIZATION,
  NOT_FOUND: ErrorType.NOT_FOUND,
  CONFLICT: ErrorType.CONFLICT,
  SERVER: ErrorType.SERVER,
  UNKNOWN: ErrorType.UNKNOWN,
};

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: 'Verifique sua conexão de internet',
  [ErrorType.VALIDATION]: 'Dados inválidos fornecidos',
  [ErrorType.AUTH]: 'Email ou senha incorretos',
  [ErrorType.AUTHORIZATION]: 'Você não tem permissão para esta ação',
  [ErrorType.NOT_FOUND]: 'Recurso não encontrado',
  [ErrorType.CONFLICT]: 'Conflito com dados existentes',
  [ErrorType.SERVER]: 'Erro no servidor. Tente novamente mais tarde',
  [ErrorType.UNKNOWN]: 'Ocorreu um erro inesperado',
};

export interface HandledError {
  type: ErrorType;
  message: string;
  originalError: Error;
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: string;
      error_description?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    if (maybeError.message) return maybeError.message;
    if (maybeError.error_description) return maybeError.error_description;
    if (maybeError.details) return maybeError.details;
    if (maybeError.hint) return maybeError.hint;
    if (maybeError.code) return `Erro (${maybeError.code})`;
  }

  return 'Erro desconhecido';
};

/**
 * Analisa um erro e retorna tipo e mensagem estruturada
 */
export const handleError = (error: unknown, context: string = ''): HandledError => {
  const rawMessage = extractErrorMessage(error);
  const errorObj = error instanceof Error ? error : new Error(rawMessage);
  
  logger.error(`Error in ${context}:`, error);

  // Se for um objeto com message, usar isso
  if (errorObj?.message) {
    const message = errorObj.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: ERROR_MESSAGES[ErrorType.NETWORK],
        originalError: errorObj,
      };
    }

    if (message.includes('invalid') || message.includes('validation')) {
      return {
        type: ErrorType.VALIDATION,
        message: ERROR_MESSAGES[ErrorType.VALIDATION],
        originalError: errorObj,
      };
    }

    if (message.includes('unauthorized') || message.includes('invalid password')) {
      return {
        type: ErrorType.AUTH,
        message: ERROR_MESSAGES[ErrorType.AUTH],
        originalError: errorObj,
      };
    }

    if (
      message.includes('forbidden') ||
      message.includes('permission denied') ||
      message.includes('row-level security')
    ) {
      return {
        type: ErrorType.AUTHORIZATION,
        message: ERROR_MESSAGES[ErrorType.AUTHORIZATION],
        originalError: errorObj,
      };
    }

    if (message.includes('not found')) {
      return {
        type: ErrorType.NOT_FOUND,
        message: ERROR_MESSAGES[ErrorType.NOT_FOUND],
        originalError: errorObj,
      };
    }

    if (message.includes('conflict')) {
      return {
        type: ErrorType.CONFLICT,
        message: ERROR_MESSAGES[ErrorType.CONFLICT],
        originalError: errorObj,
      };
    }

    if (message.includes('server')) {
      return {
        type: ErrorType.SERVER,
        message: ERROR_MESSAGES[ErrorType.SERVER],
        originalError: errorObj,
      };
    }
  }

  return {
    type: ErrorType.UNKNOWN,
    message: rawMessage !== 'Erro desconhecido' ? rawMessage : ERROR_MESSAGES[ErrorType.UNKNOWN],
    originalError: errorObj,
  };
};

export default { handleError, ERROR_TYPES, ERROR_MESSAGES };
