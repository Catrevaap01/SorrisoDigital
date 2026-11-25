import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  getOfflineQueue,
  processOfflineQueue,
  subscribeOfflineQueue,
} from '../services/offlineSyncService';
import { fetchIsOnline, isNetworkOnline } from '../utils/networkUtils';

/**
 * Hook that tracks real network status across BOTH web and mobile.
 * - Web: uses both `window.online/offline` events AND NetInfo for accuracy.
 * - Mobile: uses `@react-native-community/netinfo` + AppState.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(isNetworkOnline(state));
    });

    fetchIsOnline().then(setIsOnline);

    let handleOnline: (() => void) | undefined;
    let handleOffline: (() => void) | undefined;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      handleOnline = () => setIsOnline(true);
      handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        fetchIsOnline().then(setIsOnline);
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && handleOnline && handleOffline) {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  return { isOnline };
}

/**
 * Hook that manages the offline sync queue.
 * Automatically processes pending actions when connectivity is restored.
 * Works on both web (browser events + NetInfo) and mobile (NetInfo + AppState).
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const prevOnlineRef = useRef<boolean | null>(null);
  const isSyncingRef = useRef(false);

  const updatePending = useCallback(async () => {
    try {
      const actions = await getOfflineQueue();
      setPendingCount(actions.length);
    } catch {
      // Silently fail — queue may be empty or inaccessible
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current) return { synced: 0, failed: 0, dropped: 0 };

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await processOfflineQueue();
      if (result.synced > 0) {
        setLastSync(new Date().toISOString());
      }
      await updatePending();
      return result;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [updatePending]);

  // ─── Subscribe to queue changes in real time ─────────────────────────────
  useEffect(() => {
    updatePending();
    const unsubQueue = subscribeOfflineQueue((count) => {
      setPendingCount(count);
    });
    return unsubQueue;
  }, [updatePending]);

  // ─── Auto-sync when connectivity changes from offline → online ──────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = isNetworkOnline(state);
      const wasOffline = prevOnlineRef.current === false;
      prevOnlineRef.current = nowOnline;

      if (nowOnline && wasOffline) {
        console.log('📡 Rede restaurada — sincronizando fila offline...');
        syncNow();
      }
    });

    fetchIsOnline().then((online) => {
      prevOnlineRef.current = online;
      if (online) {
        syncNow();
      }
    });

    let handleOnline: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      handleOnline = () => {
        console.log('📡 Browser online event — sincronizando fila offline...');
        prevOnlineRef.current = true;
        syncNow();
      };
      window.addEventListener('online', handleOnline);
    }

    const appStateSub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const online = await fetchIsOnline();
        if (online) {
          syncNow();
        }
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && handleOnline) {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [syncNow]);

  return { pendingCount, isSyncing, lastSync, syncNow };
}
