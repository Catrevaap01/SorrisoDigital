// ─────────────────────────────────────────────────────────────────────────────
// src/contexts/PresenceContext.tsx
// Sistema de Presença em Tempo Real (Online / Offline) via Supabase Realtime
// Funciona 100% em Web, PWA (background/foreground) e Mobile (AppState React Native)
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { supabase } from '../config/supabase';
import { realtimeBus } from '../realtime/realtime';
import { logger } from '../utils/logger';

interface PresenceContextValue {
  onlineUsers: Set<string>;                 // Conjunto de IDs de utilizadores actualmente online
  isUserOnline: (userId?: string) => boolean; // Função utilitária para verificar se um utilizador está online
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

export const usePresence = (): PresenceContextValue => useContext(PresenceContext);

interface PresenceProviderProps {
  children: ReactNode;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
  const { user, profile } = useAuth();
  const { isOnline } = useNetwork();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const currentUserId = user?.id;
    if (!currentUserId || !isOnline) {
      // Se não houver utilizador ou não houver internet, limpa estado
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setOnlineUsers(new Set());
      return;
    }

    // Criar canal de presença global
    const presenceChannel = supabase.channel('presence-global', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channelRef.current = presenceChannel;

    // Handler para sincronizar utilizadores online sempre que a presença muda
    const updatePresenceState = () => {
      if (!presenceChannel) return;
      const state = presenceChannel.presenceState();
      const onlineSet = new Set<string>();

      // Adiciona o próprio utilizador para garantir resposta imediata
      onlineSet.add(currentUserId);

      // Percorre todas as chaves e registos de presença
      Object.keys(state).forEach((key) => {
        onlineSet.add(key);
        const presences = state[key] as any[];
        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (p.user_id) onlineSet.add(p.user_id);
          });
        }
      });

      setOnlineUsers(onlineSet);
      realtimeBus.emit('presence:sync', { onlineUserIds: Array.from(onlineSet) });
    };

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        updatePresenceState();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          next.add(key);
          newPresences?.forEach((p: any) => p.user_id && next.add(p.user_id));
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          // Só remove se a chave for diferente do utilizador actual
          if (key !== currentUserId) {
            next.delete(key);
            leftPresences?.forEach((p: any) => p.user_id && next.delete(p.user_id));
          }
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Presence: Subscrito no canal de presença para o user ${currentUserId}`);
          await presenceChannel.track({
            user_id: currentUserId,
            user_type: profile?.tipo || 'utilizador',
            online_at: new Date().toISOString(),
          });
        }
      });

    // ── Gestão de ciclo de vida (Mobile AppState e Web Visibility) ───────────
    const handleStateActive = async () => {
      if (channelRef.current && isOnline && user?.id) {
        await channelRef.current.track({
          user_id: user.id,
          user_type: profile?.tipo || 'utilizador',
          online_at: new Date().toISOString(),
        });
      }
    };

    const handleStateInactive = async () => {
      if (channelRef.current) {
        await channelRef.current.untrack();
      }
    };

    // Subscrição do AppState no React Native (Mobile)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        handleStateActive();
      } else if (nextState === 'background' || nextState === 'inactive') {
        handleStateInactive();
      }
    });

    // Subscrição de eventos Web / PWA (Visibilidade do separador e foco da janela)
    if (Platform.OS === 'web') {
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          handleStateActive();
        } else {
          handleStateInactive();
        }
      };

      const handleFocus = () => handleStateActive();
      const handleBlur = () => handleStateInactive();

      document.addEventListener('visibilitychange', handleVisibility);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      return () => {
        appStateSub.remove();
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        if (channelRef.current) {
          channelRef.current.untrack();
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }

    return () => {
      appStateSub.remove();
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, profile?.tipo, isOnline]);

  // Função utilitária para testar se um utilizador específico está online
  const isUserOnline = (userId?: string): boolean => {
    if (!userId) return false;
    // O utilizador logado no dispositivo actual está sempre considerado online se houver rede
    if (user?.id && userId === user.id && isOnline) return true;
    return onlineUsers.has(userId);
  };

  const value = useMemo(
    () => ({
      onlineUsers,
      isUserOnline,
    }),
    [onlineUsers, user?.id, isOnline]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};
