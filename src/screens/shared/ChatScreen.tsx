/**
 * Tela de Chat
 * Conversa em tempo real entre dentista e paciente
 * Compartilhada entre ambos os tipos de usuário
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import {
  Message,
  listarMensagens,
  enviarMensagem,
  marcarMensagensComoLidas,
  subscribeAMensagensEmTempoReal,
} from '../../services/messagesService';
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatScreenProps {
  conversationId: string;
  otherUserName: string;
  otherUserAvatar?: string;
  onBack?: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  conversationId,
  otherUserName,
  otherUserAvatar,
  onBack,
}) => {
  const { user, profile } = useAuth();
  const [mensagens, setMensagens] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [envio, setEnvio] = useState(false);
  const [novaMensagem, setNovaMensagem] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  // Carregar mensagens
  const carregarMensagens = async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const resultado = await listarMensagens(conversationId, 50);
      if (!resultado.success) {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar mensagens',
        });
      } else if (resultado.data) {
        setMensagens(resultado.data);
        // Marcar como lidas
        if (user?.id) {
          await marcarMensagensComoLidas(conversationId, user.id);
          // atualizar badge imediatamente (supabase realtime não ecoa a própria alteração)
          await import('../../navigation/AppNavigator').then((mod) => {
            mod.triggerUnreadRefresh();
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll para o final quando novas mensagens chegam
  const scrollParaFinal = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Carregar mensagens ao focar tela
  useFocusEffect(
    useCallback(() => {
      carregarMensagens();
    }, [conversationId])
  );

  // Setup de real-time quando conversationId muda
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    // Subscribe a mensagens em tempo real
    const subscription = subscribeAMensagensEmTempoReal(
      conversationId,
      (novaMsg) => {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === novaMsg.id)) return prev;
          return [...prev, novaMsg];
        });
        scrollParaFinal();
        // Marcar como lida imediatamente
        if (user.id !== novaMsg.sender_id) {
          marcarMensagensComoLidas(conversationId, user.id);
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
  }, [conversationId, user?.id]);

  // Enviar mensagem
  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim()) return;
    if (!user?.id || !profile?.nome) return;

    setEnvio(true);
    try {
      const resultado = await enviarMensagem(
        conversationId,
        user.id,
        profile.nome,
        profile.foto_url || null,
        novaMensagem.trim()
      );

      if (resultado.success) {
        if (resultado.data) {
          // Atualiza UI localmente mesmo se o realtime atrasar/falhar.
          setMensagens((prev) => {
            if (prev.some((m) => m.id === resultado.data?.id)) return prev;
            return [...prev, resultado.data as Message];
          });
        }
        // Ao responder, limpa pendencias nao lidas da conversa para este usuario.
        await marcarMensagensComoLidas(conversationId, user.id);
        await import('../../navigation/AppNavigator').then((mod) => {
          mod.triggerUnreadRefresh();
        });
        setNovaMensagem('');
        scrollParaFinal();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Não foi possível enviar a mensagem',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao enviar mensagem',
      });
    } finally {
      setEnvio(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarMensagens();
    setRefreshing(false);
  };

  // Renderizar item de mensagem
  const renderMensagem = ({ item }: { item: Message }) => {
    const isOwn = user?.id === item.sender_id;
    const displayName = isOwn
      ? 'Você'
      : item.sender_name || otherUserName || 'Sem nome';

    return (
      <View style={[styles.mensagemContainer, isOwn && styles.mensagemOwn]}>
        {/* show sender name above bubble */}
        <Text
          style={[
            styles.mensagemRemetente,
            isOwn && styles.mensagemRemetenteOwn,
          ]}
        >
          {displayName}
        </Text>
        <View style={[styles.mensagemBubble, isOwn && styles.mensagemBubbleOwn]}>
          <Text style={[styles.mensagemTexto, isOwn && styles.mensagemTextoOwn]}>
            {item.content}
          </Text>
          <Text
            style={[
              styles.mensagemHora,
              isOwn && styles.mensagemHoraOwn,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString('pt-PT', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {onBack ? (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {otherUserName?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{otherUserName}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
      </View>

      {/* Lista de mensagens */}
      <FlatList
        ref={flatListRef}
        data={mensagens}
        renderItem={renderMensagem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.mensagensContainer}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
              <Text style={styles.emptySubtext}>Comece uma conversa!</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onContentSizeChange={() => scrollParaFinal()}
      />

      {/* Input de mensagem */}
      <View style={styles.inputContainer}>
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Digite uma mensagem..."
            placeholderTextColor={COLORS.textSecondary}
            value={novaMensagem}
            onChangeText={setNovaMensagem}
            multiline
            maxLength={500}
            editable={!envio}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!novaMensagem.trim() || envio) && styles.sendButtonDisabled,
            ]}
            onPress={handleEnviarMensagem}
            disabled={!novaMensagem.trim() || envio}
          >
            {envio ? (
              <ActivityIndicator color={COLORS.textInverse} size="small" />
            ) : (
              <Ionicons name="send" size={20} color={COLORS.textInverse} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  backButton: {
    marginRight: SPACING.xs,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerStatus: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.success,
    marginTop: 2,
  },
  mensagensContainer: {
    paddingVertical: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  mensagemContainer: {
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    alignItems: 'flex-start',
  },
  mensagemOwn: {
    alignItems: 'flex-end',
  },
  mensagemBubble: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    maxWidth: '80%',
    borderBottomLeftRadius: 2,
  },
  mensagemBubbleOwn: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 2,
  },
  mensagemTexto: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
    lineHeight: 20,
  },
  mensagemTextoOwn: {
    color: COLORS.textInverse,
  },
  mensagemHora: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  mensagemHoraOwn: {
    color: COLORS.textInverse,
    opacity: 0.7,
  },
  mensagemRemetente: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  mensagemRemetenteOwn: {
    color: COLORS.textInverse,
    opacity: 0.7,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    paddingBottom: Math.max(SPACING.md, 20),
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
    paddingVertical: SPACING.md,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ChatScreen;
