import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const memoryStorage = new Map<string, string>();

const isAsyncStorageUnavailable = (error: unknown): boolean => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('native module is null') ||
    message.includes('legacy storage') ||
    message.includes('asyncstorage is null')
  );
};

const getMemoryItem = (key: string): string | null => memoryStorage.get(key) ?? null;
const setMemoryItem = (key: string, value: string): void => {
  memoryStorage.set(key, value);
};
const removeMemoryItem = (key: string): void => {
  memoryStorage.delete(key);
};

/**
 * Utilitário de armazenamento universal (Web e Mobile)
 * Resolve erro de "Native module is null" no Web
 */
export const universalStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await AsyncStorage.getItem(key);
    } catch (error) {
      if (isAsyncStorageUnavailable(error)) {
        return getMemoryItem(key);
      }
      logger.warn(`Erro ao ler storage [${key}]:`, error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      if (isAsyncStorageUnavailable(error)) {
        setMemoryItem(key, value);
        return;
      }
      logger.warn(`Erro ao escrever no storage [${key}]:`, error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (error) {
      if (isAsyncStorageUnavailable(error)) {
        removeMemoryItem(key);
        return;
      }
      logger.warn(`Erro ao remover do storage [${key}]:`, error);
    }
  }
};
