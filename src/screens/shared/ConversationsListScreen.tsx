/**
 * Tela de Lista de Conversas
 * Compartilhada entre dentista e paciente
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import {
  Conversation,
  listarConversasDoUsuario,
  contarMensagensNaoLidas,
} from '../../services/messagesService';

interface ConversationsListScreenProps {
  onSelectConversation: (
    conversationId: string,
    otherUserName: string,
    otherUserAvatar?: string
  ) => void;
}

const ConversationsListScreen: React.FC<ConversationsListScreenProps> = ({
  onSelectConversation,
}) => {
  const { user } = useAuth();
  const [conversas, setConversas] = useState<
    (Conversation & { naoLidas: number })[]
  >([]);
  const [conversasOrig, setConversasOrig] = useState<
    (Conversation & { naoLidas: number })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  // Carregar conversas
  const carregarConversas = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const resultado = await listarConversasDoUsuario(user.id);
      if (resultado.success && resultado.data) {
        // Contar mensagens não lidas para cada conversa
        const conversasComNaoLidas = await Promise.all(
          resultado.data.map(async (conversa) => {
            const naoLidasResult = await contarMensagensNaoLidas(
              conversa.id,
              user.id
            );
            return {
              ...conversa,
              naoLidas: naoLidasResult.count || 0,
            };
          })
        );

        setConversas(conversasComNaoLidas);
        setConversasOrig(conversasComNaoLidas);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao carregar conversas',
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarConversas();
    }, [user?.id])
  );

  // Buscar conversa
  const handleBusca = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) {
      const filtrados = conversasOrig.filter(
        (c) =>
          (c.participant_1_id === user?.id
            ? c.participant_2_name
            : c.participant_1_name
          )
            ?.toLowerCase()
            .includes(texto.toLowerCase())
      );
      setConversas(filtrados);
    } else {
      setConversas(conversasOrig);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarConversas();
    setRefreshing(false);
  };

  // Renderizar item de conversa
  const renderConversa = ({
    item,
  }: {
    item: Conversation & { naoLidas: number };
  }) => {
    const isParticipant1 = user?.id === item.participant_1_id;
    const otherUserName = isParticipant1
      ? item.participant_2_name || 'Sem nome'
      : item.participant_1_name || 'Sem nome';
    const otherUserAvatar = isParticipant1
      ? item.participant_2_avatar
      : item.participant_1_avatar;

    return (
      <TouchableOpacity
        style={styles.conversaCard}
        onPress={() =>
          onSelectConversation(item.id, otherUserName, otherUserAvatar)
        }
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.conversaInfo}>
          <View style={styles.conversaHeader}>
            <Text style={styles.conversaNome}>{otherUserName}</Text>
            <Text style={styles.conversaHora}>
              {item.last_message_at
                ? new Date(item.last_message_at).toLocaleTimeString(
                    'pt-PT',
                    { hour: '2-digit', minute: '2-digit' }
                  )
                : ''}
            </Text>
          </View>
          <Text
            style={styles.conversaMensagem}
            numberOfLines={1}
          >
            {item.last_message || 'Nenhuma mensagem'}
          </Text>
        </View>

        {item.naoLidas > 0 && (
          <View style={styles.badgeNaoLidas}>
            <Text style={styles.badgeText}>{item.naoLidas}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar conversa..."
          placeholderTextColor={COLORS.textSecondary}
          value={busca}
          onChangeText={handleBusca}
        />
        {busca ? (
          <TouchableOpacity onPress={() => handleBusca('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Lista de conversas */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversas}
          renderItem={renderConversa}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyText}>Nenhuma conversa</Text>
              <Text style={styles.emptySubtext}>
                {busca ? 'Nenhuma conversa encontrada' : 'Comece uma nova conversa'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  conversaInfo: {
    flex: 1,
  },
  conversaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  conversaNome: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  conversaHora: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },
  conversaMensagem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
  },
  badgeNaoLidas: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    minWidth: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
});

export default ConversationsListScreen;
