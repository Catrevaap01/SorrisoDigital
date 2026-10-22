import { getExpoExtra, supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { RealtimeBus } from './realtimeBus';
import type { DbChangeEvent, RealtimeEvents } from './realtimeEvents';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const realtimeBus = new RealtimeBus<RealtimeEvents>();

const REALTIME_TABLES = [
  'triagens',
  'respostas_triagem',
  'appointments',
  'profiles',
  'dentistas',
  'provincias',
  'messages',
  'conversations',
  'notificacoes',
  'procedimentos_tratamento',
  'planos_tratamento',
  'anamneses',
  'prescricoes',
  'evolucoes_clinicas',
  'conteudos_educacionais',
  'conteudos_educativos',
] as const;

const toDbChangeEvent = (table: string, payload: any): DbChangeEvent => ({
  table,
  eventType: payload?.eventType,
  new: payload?.new ?? null,
  old: payload?.old ?? null,
  commitTimestamp: payload?.commit_timestamp ?? payload?.commitTimestamp,
});

export const startRealtime = (options: {
  userId: string;
  role?: string | null;
  enabled?: boolean;
}): { channel: RealtimeChannel | null; stop: () => void } => {
  const { userId, role, enabled = true } = options;
  const extra = getExpoExtra();
  const debug =
    !!extra?.REALTIME_DEBUG ||
    (typeof process !== 'undefined' &&
      (process.env?.EXPO_PUBLIC_REALTIME_DEBUG === '1' ||
        process.env?.REALTIME_DEBUG === '1'));

  if (!enabled || !userId) {
    return { channel: null, stop: () => {} };
  }

  const channelName = `global-realtime-${role || 'user'}-${userId}`;
  logger.info(`Realtime: subscribing (${channelName})`);

  const channel = supabase.channel(channelName);

  REALTIME_TABLES.forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      if (debug) logger.debug(`Realtime event: ${table}`, { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent(table, payload));
    });
  });

  channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        logger.info(`Realtime: subscribed (${channelName})`);
        realtimeBus.emit('realtime:status', { connected: true, status });
      }
      if (err) {
        logger.warn(`Realtime: subscription error (${channelName})`, err);
        realtimeBus.emit('realtime:status', { connected: false, status: String(status || 'error') });
      }
      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        realtimeBus.emit('realtime:status', { connected: false, status });
      }
    });

  const stop = () => {
    try {
      logger.info(`Realtime: unsubscribing (${channelName})`);
      channel.unsubscribe();
    } catch {
      // no-op
    }
  };

  return { channel, stop };
};
