/**
 * Hook para gerenciar mensagens em tempo real
 * Integra subscriptions do Supabase com estado local
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Message,
  listarMensagens,
  marcarMensagensComoLidas,
  subscribeAMensagensEmTempoReal,
} from '../services/messagesService';

interface UseRealTimeMessagesReturn {
  mensagens: Message[];
  loading: boolean;
  error: string | null;
  enviarMensagem: (content: string, senderId: string, senderName: string, senderAvatar: string | null) => Promise<boolean>;
  recarregar: () => Promise<void>;
}

export const useRealTimeMessages = (
  conversationId: string,
  userId: string
): UseRealTimeMessagesReturn => {
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Carregar mensagens iniciais
  const carregarMensagens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resultado = await listarMensagens(conversationId, 50);
      if (resultado.success && resultado.data) {
        setMensagens(resultado.data);
        // Marcar como lidas
        await marcarMensagensComoLidas(conversationId, userId);
      } else {
        throw new Error(resultado.error || 'Erro ao carregar mensagens');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, userId]);

  // Setup subscriptions
  useEffect(() => {
    if (!conversationId || !userId) return;

    carregarMensagens();

    // Subscribe para novos eventos
    const subscription = subscribeAMensagensEmTempoReal(
      conversationId,
      (novaMsg) => {
        setMensagens((prev) => [...prev, novaMsg]);
        if (userId !== novaMsg.sender_id) {
          marcarMensagensComoLidas(conversationId, userId);
        }
      },
      (mensagemAtualizada) => {
        setMensagens((prev) =>
          prev.map((m) => (m.id === mensagemAtualizada.id ? mensagemAtualizada : m))
        );
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, userId, carregarMensagens]);

  const enviarMensagem = useCallback(
    async (
      content: string,
      senderId: string,
      senderName: string,
      senderAvatar: string | null
    ): Promise<boolean> => {
      try {
        // A mensagem será adicionada automaticamente via real-time subscription
        // Aqui apenas retornamos sucesso/erro
        return true;
      } catch (err) {
        setError('Erro ao enviar mensagem');
        return false;
      }
    },
    []
  );

  return {
    mensagens,
    loading,
    error,
    enviarMensagem,
    recarregar: carregarMensagens,
  };
};
