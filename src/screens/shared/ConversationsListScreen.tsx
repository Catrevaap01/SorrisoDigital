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
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { supabase } from '../../config/supabase';
import {
  Conversation,
  listarConversasDoUsuario,
  contarMensagensNaoLidas,
  marcarMensagensComoLidas,
  obterOuCriarConversa,
} from '../../services/messagesService';
import { listarPacientes, PacienteProfile } from '../../services/pacienteService';

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
  const { user, profile } = useAuth();
  const [conversas, setConversas] = useState<
    (Conversation & { naoLidas: number })[]
  >([]);
  const [conversasOrig, setConversasOrig] = useState<
    (Conversation & { naoLidas: number })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  // Estados para Nova Conversa
  const [modalVisible, setModalVisible] = useState(false);
  const [pacientes, setPacientes] = useState<PacienteProfile[]>([]);
  const [pacientesOrig, setPacientesOrig] = useState<PacienteProfile[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const accentColor =
    profile?.tipo === 'secretario'
      ? '#6D28D9'
      : profile?.tipo === 'dentista' || profile?.tipo === 'medico'
      ? COLORS.secondary
      : COLORS.primary;

  // Carregar conversas
  const carregarConversas = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      let resultado = await listarConversasDoUsuario(user.id);
      if (!resultado.success) {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar conversas',
        });
      } else if (resultado.data) {
        let conversasData = resultado.data as Conversation[];

        // se houver conversas com nomes faltando, busca perfis para preencher
        const missingIds = new Set<string>();
        conversasData.forEach((c) => {
          if (!c.participant_1_name && c.participant_1_id) {
            missingIds.add(c.participant_1_id);
          }
          if (!c.participant_2_name && c.participant_2_id) {
            missingIds.add(c.participant_2_id);
          }
        });
        if (missingIds.size) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nome, foto_url')
            .in('id', Array.from(missingIds));
          const profMap = Object.fromEntries(
            (profiles || []).map((p: any) => [p.id, p])
          );

          const updates: Array<any> = [];
          conversasData = conversasData.map((c) => {
            const updated = { ...c } as any;
            if (!c.participant_1_name && profMap[c.participant_1_id]) {
              updated.participant_1_name = profMap[c.participant_1_id].nome;
              updated.participant_1_avatar = profMap[c.participant_1_id].foto_url;
              updates.push({
                id: c.id,
                participant_1_name: updated.participant_1_name,
                participant_1_avatar: updated.participant_1_avatar,
              });
            }
            if (!c.participant_2_name && profMap[c.participant_2_id]) {
              updated.participant_2_name = profMap[c.participant_2_id].nome;
              updated.participant_2_avatar = profMap[c.participant_2_id].foto_url;
              updates.push({
                id: c.id,
                participant_2_name: updated.participant_2_name,
                participant_2_avatar: updated.participant_2_avatar,
              });
            }
            return updated;
          });

          // sincroniza no banco de dados em background
          updates.forEach((u) => {
            supabase.from('conversations').update(u).eq('id', u.id);
          });
        }

        // Contar mensagens não lidas para cada conversa
        const conversasComNaoLidas = await Promise.all(
          conversasData.map(async (conversa) => {
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

        const conversasParaLimpar = conversasComNaoLidas.filter((conversa) => conversa.naoLidas > 0);

        if (conversasParaLimpar.length > 0) {
          await Promise.all(
            conversasParaLimpar.map((conversa) =>
              marcarMensagensComoLidas(conversa.id, user.id)
            )
          );
        }

        const conversasSincronizadas = conversasComNaoLidas.map((conversa) =>
          conversa.naoLidas > 0 ? { ...conversa, naoLidas: 0 } : conversa
        );

        setConversas(conversasSincronizadas);
        setConversasOrig(conversasSincronizadas);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao carregar conversas',
      });
    } finally {
      setLoading(false);
      // sincroniza também a badge do menu
      import('../../navigation/AppNavigator').then(m => m.triggerUnreadRefresh());
    }
  };

  useFocusEffect(
    useCallback(() => {
      import('../../navigation/AppNavigator').then((m) => m.markUnreadAsSeen());
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

  // Funções para iniciar nova conversa
  const carregarPacientes = async () => {
    setLoadingPacientes(true);
    try {
      const resp = await listarPacientes();
      if (resp.success && resp.data) {
        setPacientes(resp.data);
        setPacientesOrig(resp.data);
      }
    } catch (e) {
      console.error('Erro ao carregar pacientes:', e);
    } finally {
      setLoadingPacientes(false);
    }
  };

  const handleBuscaPaciente = (text: string) => {
    setBuscaPaciente(text);
    if (!text.trim()) {
      setPacientes(pacientesOrig);
      return;
    }
    const filtered = pacientesOrig.filter(p => 
      p.nome.toLowerCase().includes(text.toLowerCase()) || 
      p.email?.toLowerCase().includes(text.toLowerCase())
    );
    setPacientes(filtered);
  };

  const iniciarConversa = async (paciente: PacienteProfile) => {
    if (!user?.id) return;
    
    setLoading(true);
    setModalVisible(false);
    
    try {
      const result = await obterOuCriarConversa(
        user.id,
        paciente.id,
        user.user_metadata?.nome || 'Dentista',
        paciente.nome,
        user.user_metadata?.foto_url,
        paciente.foto_url
      );

      if (result.success && result.data) {
        onSelectConversation(
          result.data.id, 
          paciente.nome, 
          paciente.foto_url
        );
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: result.error || 'Não foi possível iniciar a conversa'
        });
      }
    } catch (e) {
      console.error('Chat error:', e);
    } finally {
      setLoading(false);
    }
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
        onPress={async () => {
          if (user?.id) {
            const unreadToClear = item.naoLidas || 0;
            if (unreadToClear > 0) {
              await import('../../navigation/AppNavigator').then((m) =>
                m.adjustUnreadCount(-unreadToClear)
              );
            }
            await marcarMensagensComoLidas(item.id, user.id);
            await import('../../navigation/AppNavigator').then((m) => m.triggerUnreadRefresh());
          }

          setConversas((prev) =>
            prev.map((conversa) =>
              conversa.id === item.id ? { ...conversa, naoLidas: 0 } : conversa
            )
          );
          setConversasOrig((prev) =>
            prev.map((conversa) =>
              conversa.id === item.id ? { ...conversa, naoLidas: 0 } : conversa
            )
          );
          onSelectConversation(item.id, otherUserName, otherUserAvatar);
        }}
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 24}
    >
      <View style={styles.container}>
        <View style={[styles.heroCard, { backgroundColor: accentColor }]}>
          <Text style={styles.heroTitle}>Mensagens</Text>
          <Text style={styles.heroSubtitle}>
            Converse com seus contactos e acompanhe as respostas em tempo real.
          </Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeValue}>{conversas.length}</Text>
            <Text style={styles.heroBadgeLabel}>conversa(s)</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.contentWidth}>
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
        </View>

        {/* Lista de conversas */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <FlatList
            data={conversas}
            renderItem={renderConversa}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.listContent,
              Platform.OS === 'web' && { paddingBottom: 100 }
            ]}
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
                  {busca ? 'Nenhuma conversa encontrada' : 'Toque no "+" para iniciar uma nova conversa'}
                </Text>
              </View>
            }
          />
        )}

        {/* Floating Action Button for New Chat */}
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: accentColor }]}
          onPress={() => {
            setModalVisible(true);
            carregarPacientes();
          }}
        >
          <Ionicons name="add" size={30} color={COLORS.textInverse} />
        </TouchableOpacity>

        {/* Modal Seleção de Paciente */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nova Conversa</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalSearch}>
                <Ionicons name="search" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Buscar paciente..."
                  value={buscaPaciente}
                  onChangeText={handleBuscaPaciente}
                  autoFocus
                />
              </View>

              {loadingPacientes ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={COLORS.primary} />
              ) : (
                <FlatList
                  data={pacientes}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.pacienteItem}
                      onPress={() => iniciarConversa(item)}
                    >
                      <View style={styles.pacienteAvatar}>
                        <Text style={styles.pacienteAvatarText}>
                          {item.nome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.pacienteNome}>{item.nome}</Text>
                        {item.telefone && <Text style={styles.pacienteMeta}>{item.telefone}</Text>}
                      </View>
                    </TouchableOpacity>
                  )}
                  style={{ flex: 1 }}
                  ListEmptyComponent={
                    <Text style={styles.emptyTextCentral}>Nenhum paciente encontrado</Text>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentWidth: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
  },
  heroCard: {
    margin: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  heroSubtitle: {
    marginTop: SPACING.xs,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  heroBadgeValue: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
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
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
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
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 90 : 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  listContent: {
    width: '100%',
    maxWidth: 940,
    alignSelf: 'center',
    paddingBottom: SPACING.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
  pacienteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  pacienteAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pacienteAvatarText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  pacienteNome: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  pacienteMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyTextCentral: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.textSecondary,
  },
});

export default ConversationsListScreen;
