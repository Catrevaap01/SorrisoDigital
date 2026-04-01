import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
}

const OFFLINE_QUEUE_KEY = '@teodonto_offline_queue';

// Registro de handlers para sincronização
const syncHandlers: Record<string, (payload: any) => Promise<{ success: boolean; error?: any }>> = {};

export const registerSyncHandler = (type: string, handler: (payload: any) => Promise<{ success: boolean; error?: any }>) => {
  syncHandlers[type] = handler;
};

export const enqueueOfflineAction = async (type: string, payload: any) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAction[] = queueJson ? JSON.parse(queueJson) : [];
    
    const newAction: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };
    
    queue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    logger.info(`Ação offline enfileirada: ${type}`);
    return newAction;
  } catch (error) {
    logger.error('Erro ao enfileirar ação offline:', error);
    return null;
  }
};

export const getOfflineQueue = async (): Promise<OfflineAction[]> => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    return [];
  }
};

export const removeOfflineAction = async (id: string) => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.filter(a => a.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
  } catch (error) {
    logger.error('Erro ao remover ação offline:', error);
  }
};

export const processOfflineQueue = async (): Promise<{ synced: number; failed: number }> => {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  logger.info(`Iniciando processamento de fila offline (${queue.length} itens)...`);
  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    const handler = syncHandlers[action.type];
    
    if (!handler) {
      logger.warn(`Nenhum handler registrado para o tipo: ${action.type}. Ignorando.`);
      continue;
    }

    try {
      const result = await handler(action.payload);
      if (result.success) {
        await removeOfflineAction(action.id);
        synced++;
        logger.info(`Ação offline sincronizada com sucesso: ${action.type}`);
      } else {
        failed++;
        logger.error(`Falha ao sincronizar ação offline: ${action.type}`, result.error);
      }
    } catch (error) {
      failed++;
      logger.error(`Erro crítico ao processar ação offline: ${action.type}`, error);
    }
  }

  return { synced, failed };
};
