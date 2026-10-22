import { useEffect, useRef } from 'react';
import { realtimeBus } from '../realtime/realtime';
import type { DbChangeEvent } from '../realtime/realtimeEvents';

export const useRealtimeRefresh = (options: {
  enabled?: boolean;
  debounceMs?: number;
  refreshOnResume?: boolean;
  refreshOnOnline?: boolean;
  refreshOnReconnect?: boolean;
  shouldRefresh: (event: DbChangeEvent) => boolean;
  refresh: () => void | Promise<void>;
}): void => {
  const {
    enabled = true,
    debounceMs = 400,
    refreshOnResume = true,
    refreshOnOnline = true,
    refreshOnReconnect = true,
    shouldRefresh,
    refresh,
  } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRefreshRef = useRef(shouldRefresh);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    shouldRefreshRef.current = shouldRefresh;
    refreshRef.current = refresh;
  }, [shouldRefresh, refresh]);

  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        refreshRef.current();
      }, debounceMs);
    };

    const unsubDb = realtimeBus.on('db:change', (event) => {
      if (!shouldRefreshRef.current(event)) return;
      schedule();
    });

    const unsubResume = refreshOnResume
      ? realtimeBus.on('app:resume', () => schedule())
      : () => {};
    const unsubOnline = refreshOnOnline
      ? realtimeBus.on('net:online', () => schedule())
      : () => {};
    const unsubRealtime = refreshOnReconnect
      ? realtimeBus.on('realtime:status', (s) => {
          if (s.connected) schedule();
        })
      : () => {};

    return () => {
      unsubDb();
      unsubResume();
      unsubOnline();
      unsubRealtime();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    enabled,
    debounceMs,
    refreshOnResume,
    refreshOnOnline,
    refreshOnReconnect,
  ]);
};
