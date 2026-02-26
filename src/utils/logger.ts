/**
 * Logger centralizado para a aplicação
 * Proporciona consistência no output de erros e informações
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogLevels {
  DEBUG: LogLevel;
  INFO: LogLevel;
  WARN: LogLevel;
  ERROR: LogLevel;
}

const isDevelopment = __DEV__;

const LOG_LEVELS: LogLevels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const logWithLevel = (level: LogLevel, message: string, data?: unknown): void => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  if (isDevelopment) {
    console.log(`${prefix} ${message}`);
    if (data) {
      console.log(data);
    }
  }

  // Em produção, você poderia enviar logs para um serviço remoto
  if (level === LOG_LEVELS.ERROR && !isDevelopment) {
    // sendToAnalytics(level, message, data);
  }
};

export const logger = {
  debug: (message: string, data?: unknown): void =>
    logWithLevel(LOG_LEVELS.DEBUG, message, data),
  info: (message: string, data?: unknown): void =>
    logWithLevel(LOG_LEVELS.INFO, message, data),
  warn: (message: string, data?: unknown): void =>
    logWithLevel(LOG_LEVELS.WARN, message, data),
  error: (message: string, data?: unknown): void =>
    logWithLevel(LOG_LEVELS.ERROR, message, data),
};

export default logger;
