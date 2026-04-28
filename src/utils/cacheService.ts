import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { logger } from './logger';

const CACHE_PREFIX = '@teodonto_cache_';
const CACHE_EXPIRATION_MS = 1000 * 60 * 60 * 24; // 24 hours

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export const fetchWithCache = async <T>(
  key: string,
  fetcher: () => Promise<{ success: boolean; data?: T; error?: any }>,
  forceRefresh = false
): Promise<{ success: boolean; data?: T; error?: any; fromCache?: boolean }> => {
  const cacheKey = `${CACHE_PREFIX}${key}`;

  try {
    const netState = await NetInfo.fetch();
    const isOffline = !netState.isConnected || !netState.isInternetReachable;

    // Se estiver offline ou não forçar refresh, tenta pegar do cache primeiro
    if (isOffline || !forceRefresh) {
      const cachedString = await AsyncStorage.getItem(cacheKey);
      if (cachedString) {
        const cachedItem: CacheItem<T> = JSON.parse(cachedString);
        const isExpired = Date.now() - cachedItem.timestamp > CACHE_EXPIRATION_MS;

        // Retorna o cache se estiver offline (mesmo expirado) ou se não estiver expirado
        if (isOffline || !isExpired) {
          logger.info(`Lendo do cache: ${key} (Offline: ${isOffline})`);
          return { success: true, data: cachedItem.data, fromCache: true };
        }
      }
    }

    // Se chegou aqui, estamos online ou o cache expirou e queremos refresh
    if (isOffline) {
      return { success: false, error: 'Sem conexão com a internet e sem dados em cache.' };
    }

    const result = await fetcher();

    // Se o fetch foi sucesso, atualiza o cache
    if (result.success && result.data !== undefined) {
      const cacheItem: CacheItem<T> = {
        data: result.data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      logger.info(`Cache atualizado: ${key}`);
    }

    return { ...result, fromCache: false };
  } catch (error) {
    logger.error(`Erro no fetchWithCache (${key}):`, error);
    
    // Fallback de emergência para o cache
    try {
      const cachedString = await AsyncStorage.getItem(cacheKey);
      if (cachedString) {
        const cachedItem: CacheItem<T> = JSON.parse(cachedString);
        return { success: true, data: cachedItem.data, fromCache: true };
      }
    } catch (e) {}

    return { success: false, error };
  }
};

export const clearCache = async () => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
      logger.info('Cache limpo com sucesso.');
    }
  } catch (error) {
    logger.error('Erro ao limpar cache:', error);
  }
};
