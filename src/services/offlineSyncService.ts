import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { logger } from '../utils/logger';
import { isNetworkOffline } from '../utils/networkUtils';

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const OFFLINE_QUEUE_KEY = '@teodonto_offline_queue';
const MAX_RETRY_ATTEMPTS = 5;

// ── Storage abstraction ───────────────────────────────────────────────────────
// Uses localStorage on web (AsyncStorage may crash with "Native module is null")
// and AsyncStorage on mobile.
const queueStorage = {
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
      logger.warn(`offlineSyncService: erro ao ler storage [${key}]`, error);
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
      logger.warn(`offlineSyncService: erro ao escrever storage [${key}]`, error);
    }
  },
};

// ── Sync handler registry ─────────────────────────────────────────────────────
const syncHandlers: Record<string, (payload: any) => Promise<{ success: boolean; error?: any }>> = {};

export const registerSyncHandler = (type: string, handler: (payload: any) => Promise<{ success: boolean; error?: any }>) => {
  syncHandlers[type] = handler;
};

// ── Queue operations ──────────────────────────────────────────────────────────

export const enqueueOfflineAction = async (type: string, payload: any): Promise<OfflineAction | null> => {
  try {
    const queueJson = await queueStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];

    // De-duplicate: skip if same type + payload already in queue
    const payloadSignature = JSON.stringify(payload);
    const existing = queue.find(
      (action) => action.type === type && JSON.stringify(action.payload) === payloadSignature
    );
    if (existing) {
      logger.info(`Ação offline já estava na fila: ${type}`);
      return existing;
    }
    
    const newAction: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    
    queue.push(newAction);
    await queueStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    logger.info(`Ação offline enfileirada: ${type} (total na fila: ${queue.length})`);
    return newAction;
  } catch (error) {
    logger.error('Erro ao enfileirar ação offline:', error);
    return null;
  }
};

export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
  try {
    const queueJson = await queueStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    logger.warn('Erro ao ler fila offline:', error);
    return [];
  }
};

export const removeOfflineAction = async (id: string): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.filter(a => a.id !== id);
    await queueStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    logger.error('Erro ao remover ação offline:', error);
  }
};

export const clearOfflineQueue = async (): Promise<void> => {
  try {
    await queueStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
    logger.info('Fila offline limpa.');
  } catch (error) {
    logger.error('Erro ao limpar fila offline:', error);
  }
};

const updateOfflineAction = async (id: string, updates: Partial<OfflineAction>): Promise<void> => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.map((action) =>
      action.id === id ? { ...action, ...updates } : action
    );
    await queueStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    logger.error('Erro ao atualizar ação offline:', error);
  }
};

// ── Processing ────────────────────────────────────────────────────────────────

// Guard to prevent concurrent processing
let _isProcessing = false;

export const processOfflineQueue = async (): Promise<{ synced: number; failed: number; dropped: number }> => {
  // Prevent concurrent runs
  if (_isProcessing) {
    logger.info('processOfflineQueue: já está em execução, ignorando chamada duplicada.');
    return { synced: 0, failed: 0, dropped: 0 };
  }

  _isProcessing = true;

  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return { synced: 0, failed: 0, dropped: 0 };

    // Verify connectivity before starting
    const initialState = await NetInfo.fetch();
    if (isNetworkOffline(initialState)) {
      logger.info('Sincronização offline adiada: sem internet.');
      return { synced: 0, failed: queue.length, dropped: 0 };
    }

    logger.info(`Iniciando processamento de fila offline (${queue.length} itens)...`);
    let synced = 0;
    let failed = 0;
    let dropped = 0;

    for (const action of queue) {
      // Check if action exceeded max retries
      if (action.attempts >= MAX_RETRY_ATTEMPTS) {
        logger.warn(
          `Ação offline excedeu ${MAX_RETRY_ATTEMPTS} tentativas, removendo: ${action.type} (id: ${action.id}). Último erro: ${action.lastError}`
        );
        await removeOfflineAction(action.id);
        dropped++;
        continue;
      }

      // Re-check connectivity between each action
      const currentState = await NetInfo.fetch();
      if (isNetworkOffline(currentState)) {
        logger.info('Sincronização interrompida: conexão caiu durante o processamento.');
        failed += queue.length - synced - failed - dropped;
        break;
      }

      const handler = syncHandlers[action.type];
      
      if (!handler) {
        logger.warn(`Nenhum handler registrado para o tipo: ${action.type}. Removendo da fila.`);
        await removeOfflineAction(action.id);
        dropped++;
        continue;
      }

      try {
        const result = await handler(action.payload);
        if (result.success) {
          await removeOfflineAction(action.id);
          synced++;
          logger.info(`✅ Ação offline sincronizada: ${action.type} (tentativa ${action.attempts + 1})`);
        } else {
          failed++;
          await updateOfflineAction(action.id, {
            attempts: (action.attempts || 0) + 1,
            lastError: result.error?.message || String(result.error || 'Erro desconhecido'),
          });
          logger.error(`❌ Falha ao sincronizar ação offline: ${action.type}`, result.error);
        }
      } catch (error: any) {
        failed++;
        await updateOfflineAction(action.id, {
          attempts: (action.attempts || 0) + 1,
          lastError: error?.message || String(error || 'Erro crítico'),
        });
        logger.error(`❌ Erro crítico ao processar ação offline: ${action.type}`, error);
      }
    }

    logger.info(`Processamento offline concluído: ${synced} sync, ${failed} falhas, ${dropped} removidos.`);
    return { synced, failed, dropped };
  } finally {
    _isProcessing = false;
  }
};
