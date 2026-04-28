import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { logger } from '../utils/logger';
import { realtimeBus, startRealtime } from '../realtime/realtime';
import type { DbChangeEvent } from '../realtime/realtimeEvents';
import { invalidatePacienteCache } from '../services/pacienteService';
import { invalidateDentistasCache } from '../services/dentistaService';
import { useNetwork } from './NetworkContext';

export const RealtimeContext = React.createContext<{ connected: boolean } | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { isOnline } = useNetwork();
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const userId = user?.id || '';
    const role = (profile?.tipo as string | undefined) || (user?.user_metadata?.tipo as string | undefined) || undefined;

    if (!userId) {
      channelRef.current = null;
      stopRef.current?.();
      stopRef.current = null;
      setConnected(false);
      return;
    }

    stopRef.current?.();
    stopRef.current = null;
    setConnected(false);

    const { channel, stop } = startRealtime({ userId, role, enabled: true });
    channelRef.current = channel;
    stopRef.current = stop;

    const statusUnsub = realtimeBus.on('db:change', (evt: DbChangeEvent) => {
      if (evt.table !== 'profiles') return;
      const rowId = String(evt.new?.id || evt.old?.id || '');
      if (!rowId) return;

      // Invalidar caches locais para garantir refetch imediato em toda app.
      invalidatePacienteCache(rowId).catch(() => {});
      invalidateDentistasCache();
    });

    // best-effort: infer "connected" from channel state
    const interval = setInterval(() => {
      const state = (channelRef.current as any)?.state;
      setConnected(state === 'joined');
    }, 1000);

    logger.info('RealtimeProvider: started');

    return () => {
      clearInterval(interval);
      statusUnsub();
      stop();
      channelRef.current = null;
      stopRef.current = null;
      setConnected(false);
      logger.info('RealtimeProvider: stopped');
    };
  }, [user?.id, profile?.tipo]);

  // Emit events to force refresh on resume/focus (important for PWA/background).
  useEffect(() => {
    const emitResume = () => realtimeBus.emit('app:resume', { timestamp: Date.now() });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        emitResume();
      }
    });

    if (Platform.OS === 'web') {
      const onVis = () => {
        if (document.visibilityState === 'visible') emitResume();
      };
      const onFocus = () => emitResume();
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', onFocus);
      return () => {
        sub.remove();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', onFocus);
      };
    }

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isOnline) {
      realtimeBus.emit('net:online', { timestamp: Date.now() });
    }
  }, [isOnline]);

  const value = useMemo(() => ({ connected }), [connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
