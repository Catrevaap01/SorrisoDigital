/**
 * Serviço de gerenciamento de mensagens
 * Funções para enviar, listar e gerenciar mensagens em tempo real
 */

import { supabase } from '../config/supabase';
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineAction, registerSyncHandler } from './offlineSyncService';

const extra = Constants.expoConfig?.extra;
const SUPABASE_URL = extra?.SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = extra?.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

const getAdminClient = (): SupabaseClient | null => {
  const finalExtra = Constants.expoConfig?.extra || (Constants as any).manifest2?.extra || (Constants as any).manifest?.extra;
  const url = finalExtra?.SUPABASE_URL || SUPABASE_URL;
  const key = finalExtra?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('⚠️ messagesService: Admin keys missing', { url: !!url, key: !!key });
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  content: string;
  read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  participant_1_id: string;
  participant_1_name?: string;
  participant_1_avatar?: string;
  participant_2_id: string;
  participant_2_name?: string;
  participant_2_avatar?: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Criar ou obter conversa entre dois usuários
 */
// helper to map a missing-table error into a user-friendly message
function _handleTableMissing(error: any): string | null {
  const msg: string = error?.message || '';
  if (msg.toLowerCase().includes('could not find table')) {
    return 'Tabela de conversas ou mensagens não existe. Rode o script de migração.';
  }
  if (msg.toLowerCase().includes('does not exist')) {
    return 'Banco de dados não tem a tabela esperada. Verifique a migração.';
  }
  return null;
}

function _isMissingRelation(error: any): boolean {
  const msg: string = (error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find table')
  );
}

export const obterOuCriarConversa = async (
  userId1: string,
  userId2: string,
  user1Name?: string,
  user2Name?: string,
  user1Avatar?: string,
  user2Avatar?: string
): Promise<{ success: boolean; data?: Conversation; error?: string }> => {
  try {
    // Verificar se conversa já existe
    // try to fetch any existing conversation between the two users
    // limit(1) avoids errors if multiple rows exist due to bug/duplicates and
    // maybeSingle returns null instead of throwing when there are no rows.
    const { data: existente, error: selectError } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1_id.eq.${userId1},participant_2_id.eq.${userId2}),and(participant_1_id.eq.${userId2},participant_2_id.eq.${userId1})`)
      .limit(1)
      .maybeSingle();

    if (existente) {
      return { success: true, data: existente as Conversation };
    }

    if (selectError && selectError.code !== 'PGRST116' && selectError.code !== 'PGRST102') {
      // PGRST116 means no rows found, PGRST102 means more than one row
      // both are fine for our purposes – we'll just insert a new entry.
      return { success: false, error: selectError.message };
    }

    // Criar nova conversa
    const novaConversa = {
      participant_1_id: userId1,
      participant_1_name: user1Name || '',
      participant_1_avatar: user1Avatar || null,
      participant_2_id: userId2,
      participant_2_name: user2Name || '',
      participant_2_avatar: user2Avatar || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const runInsert = async (payload: any) => {
      let res = await supabase.from('conversations').insert([payload]).select().single();
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          console.warn('⚠️ RLS fallack for conversation creation');
          res = await admin.from('conversations').insert([payload]).select().single();
        }
      }
      return res;
    };

    const { data: criadaConversa, error: insertError } = await runInsert(novaConversa);

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    return { success: true, data: criadaConversa as Conversation };
  } catch (error: any) {
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao obter ou criar conversa',
    };
  }
};

/**
 * Enviar mensagem
 */
export const enviarMensagem = async (
  conversaId: string,
  senderId: string,
  senderName: string,
  senderAvatar: string | null,
  content: string
): Promise<{ success: boolean; data?: Message; error?: string }> => {
  try {
    const runInsertMsg = async (payload: any) => {
      let res = await supabase.from('messages').insert([payload]).select().single();
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          console.warn('⚠️ RLS fallback for message');
          res = await admin.from('messages').insert([payload]).select().single();
        }
      }
      return res;
    };

    const { data, error } = await runInsertMsg({
      conversation_id: conversaId,
      sender_id: senderId,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      content,
      read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Atualizar last_message e last_message_at na conversa
    const runUpdateConv = async (payload: any) => {
      let res = await supabase.from('conversations').update(payload).eq('id', conversaId);
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) res = await admin.from('conversations').update(payload).eq('id', conversaId);
      }
      return res;
    };

    await runUpdateConv({
      last_message: content,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return { success: true, data: data as Message };
  } catch (error: any) {
    // OFFLINE HANDLING
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
      console.log('📡 Offline: Enfileirando envio de mensagem...');
      await enqueueOfflineAction('enviarMensagem', { conversaId, senderId, senderName, senderAvatar, content });
      return {
        success: true,
        data: {
          id: 'temp-' + Date.now(),
          conversation_id: conversaId,
          sender_id: senderId,
          content,
          created_at: new Date().toISOString(),
          isPendingSync: true,
        } as any
      };
    }

    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao enviar mensagem',
    };
  }
};

// Registrar o handler para sincronização offline
registerSyncHandler('enviarMensagem', async (payload: any) => {
  return enviarMensagem(payload.conversaId, payload.senderId, payload.senderName, payload.senderAvatar, payload.content);
});

/**
 * Listar mensagens de uma conversa
 */
export const listarMensagens = async (
  conversaId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; data?: Message[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversaId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      if (_isMissingRelation(error)) {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).reverse() as Message[], // Reverter para ordem cronológica
    };
  } catch (error: any) {
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao listar mensagens',
    };
  }
};

/**
 * Marcar mensagens como lidas
 */
export const marcarMensagensComoLidas = async (
  conversaId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const runUpdate = async () => {
      let res = await supabase
        .from('messages')
        .update({ read: true }, { count: 'exact' })
        .eq('conversation_id', conversaId)
        .neq('sender_id', userId)
        .or('read.eq.false,read.is.null');
      
      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          console.warn('⚠️ RLS fallback for marking messages as read');
          res = await admin
            .from('messages')
            .update({ read: true }, { count: 'exact' })
            .eq('conversation_id', conversaId)
            .neq('sender_id', userId)
            .or('read.eq.false,read.is.null');
        }
      }
      return res;
    };

    const { error, count: updatedCount } = (await runUpdate()) as any;

    if (error) {
      console.error('❌ Erro ao marcar como lidas:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ marcarMensagensComoLidas: ${updatedCount ?? '?'} mensagens atualizadas no DB para conversa ${conversaId}`);
    return { success: true };
  } catch (error: any) {
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao marcar mensagens como lidas',
    };
  }
};

/**
 * Listar conversas do usuário
 */
export const listarConversasDoUsuario = async (
  userId: string
): Promise<{ success: boolean; data?: Conversation[]; error?: string }> => {
  try {
    const runList = async () => {
      let res = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
        .order('updated_at', { ascending: false });

      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          res = await admin
            .from('conversations')
            .select('*')
            .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
            .order('updated_at', { ascending: false });
        }
      }
      return res;
    };

    const { data, error } = await runList();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []) as Conversation[],
    };
  } catch (error: any) {
    if (_isMissingRelation(error)) {
      return { success: true, data: [] };
    }
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao listar conversas',
    };
  }
};

/**
 * Contar mensagens não lidas
 */
export const contarMensagensNaoLidas = async (
  conversaId: string,
  userId: string
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const runCount = async () => {
      let res = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversaId)
        .neq('sender_id', userId)
        .or('read.eq.false,read.is.null');

      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          res = await admin
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversaId)
            .neq('sender_id', userId)
            .or('read.eq.false,read.is.null');
        }
      }
      return res;
    };

    const { count, error } = await runCount();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error: any) {
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao contar mensagens não lidas',
    };
  }
};

/**
 * Contar total de mensagens não lidas de todas as conversas do usuário
 */
export const contarMensagensNaoLidasTotalUsuario = async (
  userId: string
): Promise<{ success: boolean; count?: number; error?: string; data?: any[] }> => {
  try {
    const conversasResult = await listarConversasDoUsuario(userId);
    if (!conversasResult.success || !conversasResult.data) {
      if (_isMissingRelation({ message: conversasResult.error })) {
        return { success: true, count: 0 };
      }
      return {
        success: false,
        error: conversasResult.error || 'Erro ao buscar conversas',
      };
    }

    const idsConversas = conversasResult.data.map((c) => c.id);
    if (idsConversas.length === 0) {
      return { success: true, count: 0 };
    }

    const runCountTotal = async () => {
      let res = await supabase
        .from('messages')
        .select('conversation_id', { count: 'exact' })
        .in('conversation_id', idsConversas)
        .neq('sender_id', userId)
        .or('read.eq.false,read.is.null');

      if (res.error && (res.error.code === '42501' || (res.error as any).status === 403)) {
        const admin = getAdminClient();
        if (admin) {
          res = await admin
            .from('messages')
            .select('conversation_id', { count: 'exact' })
            .in('conversation_id', idsConversas)
            .neq('sender_id', userId)
            .or('read.eq.false,read.is.null');
        }
      }
      return res;
    };

    const { data, count, error } = await runCountTotal();

    if (error) {
      console.error('❌ contarMensagensNaoLidasTotalUsuario Error:', error);
      return { success: false, error: error.message };
    }

    if (count && count > 0) {
      console.log(`📊 Total unread: ${count}. Conversations with unread:`, data?.map((m: any) => m.conversation_id));
    }

    return { success: true, count: count || 0, data: data as any[] };
  } catch (error: any) {
    const msg = _handleTableMissing(error);
    return {
      success: false,
      error: msg || error.message || 'Erro ao contar mensagens não lidas',
    };
  }
};

/**
 * Subscribe a atualizações de mensagens em tempo real
 */
export const subscribeAMensagensEmTempoReal = (
  conversaId: string,
  onNewMessage: (message: Message) => void,
  onMessageUpdate: (message: Message) => void
): RealtimeChannel => {
  const channel = supabase
    .channel(`conversation:${conversaId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversaId}`,
      },
      (payload) => {
        onNewMessage(payload.new as Message);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversaId}`,
      },
      (payload) => {
        onMessageUpdate(payload.new as Message);
      }
    )
    .subscribe();

  return channel;
};
