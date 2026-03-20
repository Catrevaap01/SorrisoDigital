import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConversationsListScreen from '../shared/ConversationsListScreen';
import ChatScreen from '../shared/ChatScreen';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { DentistaProfile, listarDentistas } from '../../services/dentistaService';
import { obterOuCriarConversa } from '../../services/messagesService';

const MensagensScreen: React.FC = () => {
  const { user, profile } = useAuth();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState('');
  const [outroAvatar, setOutroAvatar] = useState<string | undefined>(undefined);

  const [showNovoModal, setShowNovoModal] = useState(false);
  const [loadingDentistas, setLoadingDentistas] = useState(false);
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [criandoConversaId, setCriandoConversaId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tipo && profile.tipo !== 'paciente') {
      Toast.show({
        type: 'info',
        text1: 'Acesso restrito',
        text2: 'Esta tela e exclusiva para pacientes',
      });
    }
  }, [profile?.tipo]);

  if (profile?.tipo && profile.tipo !== 'paciente') {
    return <View style={styles.container} />;
  }

  const handleSelectConversa = (
    conversationId: string,
    otherUserName: string,
    otherUserAvatar?: string
  ) => {
    setConversaSelecionada(conversationId);
    setOutroNome(otherUserName);
    setOutroAvatar(otherUserAvatar);
  };

  const handleBackFromChat = () => {
    setConversaSelecionada(null);
  };

  const carregarDentistas = async () => {
    setLoadingDentistas(true);
    try {
      let result = await listarDentistas({ forceRefresh: true });
      if ((result.data?.length || 0) === 0) {
        // Segunda tentativa para evitar abrir modal vazio por atraso momentaneo.
        result = await listarDentistas({ forceRefresh: true });
      }
      if (result.success && result.data) {
        setDentistas(result.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: result.error || 'Nao foi possivel carregar dentistas',
        });
      }
    } finally {
      setLoadingDentistas(false);
    }
  };

  useEffect(() => {
    if (showNovoModal) {
      carregarDentistas();
    }
  }, [showNovoModal]);

  const iniciarConversa = async (dentista: DentistaProfile) => {
    if (!user?.id || !profile?.nome) return;
    setCriandoConversaId(dentista.id);

    const result = await obterOuCriarConversa(
      user.id,
      dentista.id,
      profile.nome,
      dentista.nome || 'Dentista',
      profile.foto_url || null,
      dentista.foto_url || null
    );

    setCriandoConversaId(null);

    if (result.success && result.data) {
      setShowNovoModal(false);
      handleSelectConversa(result.data.id, dentista.nome || 'Dentista', dentista.foto_url || undefined);
      return;
    }

    Toast.show({
      type: 'error',
      text1: 'Erro',
      text2: result.error || 'Nao foi possivel iniciar conversa',
    });
  };

  if (conversaSelecionada) {
    return (
      <View style={styles.container}>
        <ChatScreen
          conversationId={conversaSelecionada}
          otherUserName={outroNome}
          otherUserAvatar={outroAvatar}
          onBack={handleBackFromChat}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ConversationsListScreen onSelectConversation={handleSelectConversa} />

      <TouchableOpacity style={styles.fab} onPress={() => setShowNovoModal(true)}>
        <Ionicons name="add" size={26} color={COLORS.textInverse} />
      </TouchableOpacity>

      <Modal visible={showNovoModal} transparent animationType="slide" onRequestClose={() => setShowNovoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova conversa</Text>
              <TouchableOpacity onPress={() => setShowNovoModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {loadingDentistas ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={dentistas}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dentistaItem}
                    onPress={() => iniciarConversa(item)}
                    disabled={criandoConversaId === item.id}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.nome?.charAt(0).toUpperCase() || 'D'}</Text>
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.nome}>{item.nome || 'Dentista'}</Text>
                      <Text style={styles.especialidade}>{item.especialidade || 'Odontologia'}</Text>
                    </View>
                    {criandoConversaId === item.id ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="chatbubble-ellipses-outline" size={22} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>Nenhum dentista disponivel</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text,
    fontWeight: '700',
  },
  loadingWrap: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  dentistaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  nome: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
  },
  especialidade: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: 2,
  },
  emptyWrap: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.md,
  },
});

export default MensagensScreen;
