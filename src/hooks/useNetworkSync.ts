import { useCallback, useEffect, useState } from 'react';
import { getOfflineActions, syncOfflineActions } from '../services/offlineSyncService';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) {
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const updatePending = useCallback(async () => {
    const actions = await getOfflineActions();
    setPendingCount(actions.length);
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncOfflineActions();
      if (result.synced > 0) {
        setLastSync(new Date().toISOString());
      }
      await updatePending();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [updatePending]);

  useEffect(() => {
    updatePending();

    if (typeof window === 'undefined' || !window.addEventListener) {
      return;
    }

    const onOnline = async () => {
      await syncNow();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow, updatePending]);

  return { pendingCount, isSyncing, lastSync, syncNow };
}
