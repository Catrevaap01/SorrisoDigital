import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getOfflineQueue, processOfflineQueue } from '../services/offlineSyncService';
import { isNetworkOnline } from '../utils/networkUtils';

/**
 * Hook that tracks real network status across BOTH web and mobile.
 * - Web: uses both `window.online/offline` events AND NetInfo for accuracy.
 * - Mobile: uses `@react-native-community/netinfo` exclusively.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // NetInfo works on all platforms (mobile + web)
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(isNetworkOnline(state));
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      setIsOnline(isNetworkOnline(state));
    });

    // On web, also listen to browser events as a faster signal
    let handleOnline: (() => void) | undefined;
    let handleOffline: (() => void) | undefined;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      handleOnline = () => setIsOnline(true);
      handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      unsubscribe();
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
 * Works on both web (browser events + NetInfo) and mobile (NetInfo).
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const prevOnlineRef = useRef<boolean | null>(null);

  const updatePending = useCallback(async () => {
    try {
      const actions = await getOfflineQueue();
      setPendingCount(actions.length);
    } catch {
      // Silently fail — queue may be empty or inaccessible
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing) return { synced: 0, failed: 0, dropped: 0 };

    setIsSyncing(true);
    try {
      const result = await processOfflineQueue();
      if (result.synced > 0) {
        setLastSync(new Date().toISOString());
      }
      await updatePending();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [updatePending, isSyncing]);

  // ─── Auto-sync when connectivity changes from offline → online ──────────
  useEffect(() => {
    // NetInfo listener — works on ALL platforms (mobile + web)
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = isNetworkOnline(state);
      const wasOffline = prevOnlineRef.current === false;

      prevOnlineRef.current = nowOnline;

      // Trigger sync ONLY on offline → online transition
      if (nowOnline && wasOffline) {
        console.log('📡 Rede restaurada — sincronizando fila offline...');
        syncNow();
      }
    });

    // Initial state
    NetInfo.fetch().then((state) => {
      prevOnlineRef.current = isNetworkOnline(state);
    });

    // On web, ALSO listen to browser events for faster detection
    let handleOnline: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      handleOnline = () => {
        console.log('📡 Browser online event — sincronizando fila offline...');
        syncNow();
      };
      window.addEventListener('online', handleOnline);
    }

    // Load initial pending count
    updatePending();

    return () => {
      unsubscribe();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && handleOnline) {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [syncNow, updatePending]);

  return { pendingCount, isSyncing, lastSync, syncNow };
}
