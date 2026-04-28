import { getExpoExtra, supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { RealtimeBus } from './realtimeBus';
import type { DbChangeEvent, RealtimeEvents } from './realtimeEvents';
import type { RealtimeChannel } from '@supabase/supabase-js';

export const realtimeBus = new RealtimeBus<RealtimeEvents>();

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

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'triagens' }, (payload) => {
      if (debug) logger.debug('Realtime event: triagens', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('triagens', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
      if (debug) logger.debug('Realtime event: appointments', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('appointments', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
      if (debug) logger.debug('Realtime event: profiles', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('profiles', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'respostas_triagem' }, (payload) => {
      if (debug) logger.debug('Realtime event: respostas_triagem', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('respostas_triagem', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      if (debug) logger.debug('Realtime event: messages', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('messages', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
      if (debug) logger.debug('Realtime event: conversations', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('conversations', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, (payload) => {
      if (debug) logger.debug('Realtime event: notificacoes', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('notificacoes', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'procedimentos_tratamento' }, (payload) => {
      if (debug) logger.debug('Realtime event: procedimentos_tratamento', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('procedimentos_tratamento', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planos_tratamento' }, (payload) => {
      if (debug) logger.debug('Realtime event: planos_tratamento', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('planos_tratamento', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'anamneses' }, (payload) => {
      if (debug) logger.debug('Realtime event: anamneses', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('anamneses', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'prescricoes' }, (payload) => {
      if (debug) logger.debug('Realtime event: prescricoes', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('prescricoes', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conteudos_educacionais' }, (payload) => {
      if (debug) logger.debug('Realtime event: conteudos_educacionais', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('conteudos_educacionais', payload));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conteudos_educativos' }, (payload) => {
      if (debug) logger.debug('Realtime event: conteudos_educativos', { eventType: payload?.eventType });
      realtimeBus.emit('db:change', toDbChangeEvent('conteudos_educativos', payload));
    })
    .subscribe((status, err) => {
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
