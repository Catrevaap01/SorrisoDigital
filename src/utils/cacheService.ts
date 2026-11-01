import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { logger } from './logger';
import { isNetworkOffline } from './networkUtils';

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
    const isOffline = isNetworkOffline(netState);

    // Se estiver explicitamente offline, busca imediatamente do cache
    if (isOffline) {
      const cachedString = await AsyncStorage.getItem(cacheKey);
      if (cachedString) {
        const cachedItem: CacheItem<T> = JSON.parse(cachedString);
        logger.info(`Lendo do cache offline: ${key}`);
        return { success: true, data: cachedItem.data, fromCache: true };
      }
      return { success: false, error: 'Sem conexão com a internet e sem dados em cache.' };
    }

    // Se estiver online: estratégia Network-First (busca dados frescos do banco primeiro)
    try {
      const result = await fetcher();

      // Se o fetch foi sucesso, atualiza o cache local
      if (result.success && result.data !== undefined) {
        const cacheItem: CacheItem<T> = {
          data: result.data,
          timestamp: Date.now(),
        };
        await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheItem));
        logger.info(`Dados frescos atualizados no cache: ${key}`);
        return { ...result, fromCache: false };
      }
    } catch (fetchErr) {
      logger.warn(`Falha na busca em rede para ${key}, tentando fallback no cache...`, fetchErr);
    }

    // Se a busca em rede falhar, fallback de segurança para o cache
    const cachedString = await AsyncStorage.getItem(cacheKey);
    if (cachedString) {
      const cachedItem: CacheItem<T> = JSON.parse(cachedString);
      return { success: true, data: cachedItem.data, fromCache: true };
    }

    return { success: false, error: 'Falha ao buscar dados da rede e sem cache disponível.' };
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
