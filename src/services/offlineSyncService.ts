import { DBSchema, openDB } from 'idb';

export interface OfflineAction {
  id?: number;
  type: 'createPaciente' | 'criarTriagem' | 'updatePaciente' | string;
  payload: any;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  createdAt: string;
}

interface OfflineSyncTheDatabase extends DBSchema {
  actions: {
    key: number;
    value: OfflineAction;
    indexes: { 'by-createdAt': string; 'by-type': string };
  };
}

const DB_NAME = 'teodonto-offline-sync';
const DB_VERSION = 1;

const getDB = async () =>
  openDB<OfflineSyncTheDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('actions', {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('by-createdAt', 'createdAt');
      store.createIndex('by-type', 'type');
    },
  });

export const enqueueOfflineAction = async (action: Omit<OfflineAction, 'id' | 'createdAt'>) => {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  const offAction = {
    ...action,
    createdAt: new Date().toISOString(),
  };
  return db.add('actions', offAction);
};

export const getOfflineActions = async (): Promise<OfflineAction[]> => {
  if (typeof window === 'undefined') return [];
  const db = await getDB();
  return db.getAllFromIndex('actions', 'by-createdAt');
};

export const removeOfflineAction = async (id: number) => {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  return db.delete('actions', id);
};

export const clearOfflineActions = async () => {
  if (typeof window === 'undefined') return;
  const db = await getDB();
  return db.clear('actions');
};

export const syncOfflineActions = async (): Promise<{ synced: number; failed: number }> => {
  if (typeof window === 'undefined') return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const actions = await getOfflineActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify(action.payload),
      });

      if (!res.ok) {
        failed += 1;
        continue;
      }

      await removeOfflineAction(action.id!);
      synced += 1;
    } catch (error) {
      console.error('Offline sync falhou:', action, error);
      failed += 1;
    }
  }

  return { synced, failed };
};

