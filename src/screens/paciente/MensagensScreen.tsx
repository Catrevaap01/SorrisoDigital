import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ConversationsListScreen from '../shared/ConversationsListScreen';
import ChatScreen from '../shared/ChatScreen';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { DentistaProfile } from '../../services/dentistaService';
import { obterOuCriarConversa } from '../../services/messagesService';
import { getStaffAtribuidoAoPaciente } from '../../services/appointmentsService';
import { supabase } from '../../config/supabase';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

// Perfil genérico de staff (dentista ou secretário) para exibição no modal
interface StaffItem {
  id: string;
  nome: string;
  especialidade?: string;
  foto_url?: string;
  tipo: 'dentista' | 'medico' | 'secretario';
}

const MensagensScreen: React.FC = () => {
  const { user, profile } = useAuth();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState('');
  const [outroAvatar, setOutroAvatar] = useState<string | undefined>(undefined);
  const [outroUserId, setOutroUserId] = useState<string | undefined>(undefined);

  const [showNovoModal, setShowNovoModal] = useState(false);
  const [loadingDentistas, setLoadingDentistas] = useState(false);
  const [dentistas, setDentistas] = useState<StaffItem[]>([]);
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
    otherUserAvatar?: string,
    otherUserId?: string
  ) => {
    setConversaSelecionada(conversationId);
    setOutroNome(otherUserName);
    setOutroAvatar(otherUserAvatar);
    setOutroUserId(otherUserId);
  };

  const handleBackFromChat = () => {
    setConversaSelecionada(null);
  };

  /**
   * Carrega apenas o dentista atribuído ao paciente e os secretários da clínica.
   * Se o paciente não tiver agendamentos, mostra todos os secretários como fallback.
   */
  const carregarDentistas = useCallback(async () => {
    if (!user?.id) return;
    setLoadingDentistas(true);
    try {
      // 1. Obter IDs do staff atribuído via agendamentos
      const { dentistIds, secretaryIds } = await getStaffAtribuidoAoPaciente(user.id);

      // 2. Recolher todos os IDs a buscar (dentistas + secretários)
      const allIds = [...new Set([...dentistIds, ...secretaryIds])];

      let staffList: StaffItem[] = [];

      if (allIds.length > 0) {
        // Buscar perfis dos IDs encontrados
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, especialidade, foto_url, tipo')
          .in('id', allIds);

        staffList = (profiles || [])
          .filter((p: any) => p.id !== user.id)
          .map((p: any) => ({
            id: p.id,
            nome: p.nome || (p.tipo === 'secretario' ? 'Secretário(a)' : 'Dentista'),
            especialidade: p.especialidade,
            foto_url: p.foto_url,
            tipo: p.tipo,
          }));
      }

      // 3. Fallback: se não encontrou nenhum staff, buscar todos os secretários da clínica
      if (staffList.length === 0) {
        const { data: secretarios } = await supabase
          .from('profiles')
          .select('id, nome, especialidade, foto_url, tipo')
          .eq('tipo', 'secretario')
          .limit(10);

        staffList = (secretarios || [])
          .filter((p: any) => p.id !== user.id)
          .map((p: any) => ({
            id: p.id,
            nome: p.nome || 'Secretário(a)',
            especialidade: p.especialidade,
            foto_url: p.foto_url,
            tipo: p.tipo as 'secretario',
          }));
      }

      setDentistas(staffList);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Nao foi possivel carregar contactos',
      });
    } finally {
      setLoadingDentistas(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (showNovoModal) {
      carregarDentistas();
    }
  }, [carregarDentistas, showNovoModal]);

  useRealtimeRefresh({
    enabled: showNovoModal,
    debounceMs: 1200,
    shouldRefresh: (event) => {
      if (event.table !== 'profiles') return false;
      const tipo = String(event.new?.tipo || event.old?.tipo || '').toLowerCase();
      return !tipo || tipo === 'dentista' || tipo === 'medico' || tipo === 'secretario';
    },
    refresh: () => {
      void carregarDentistas();
    },
  });

  const iniciarConversa = async (staff: StaffItem) => {
    if (!user?.id || !profile?.nome) return;
    setCriandoConversaId(staff.id);

    const result = await obterOuCriarConversa(
      user.id,
      staff.id,
      profile.nome,
      staff.nome || (staff.tipo === 'secretario' ? 'Secretário(a)' : 'Dentista'),
      profile.foto_url || null,
      staff.foto_url || null
    );

    setCriandoConversaId(null);

    if (result.success && result.data) {
      setShowNovoModal(false);
      handleSelectConversa(
        result.data.id,
        staff.nome || (staff.tipo === 'secretario' ? 'Secretário(a)' : 'Dentista'),
        staff.foto_url || undefined,
        staff.id
      );
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
          otherUserId={outroUserId}
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
                      <Text style={styles.nome}>{item.nome || (item.tipo === 'secretario' ? 'Secretário(a)' : 'Dentista')}</Text>
                      <Text style={styles.especialidade}>
                        {item.tipo === 'secretario' ? 'Secretário(a)' : (item.especialidade || 'Odontologia')}
                      </Text>
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
                    <Text style={styles.emptyText}>Nenhum contacto disponível</Text>
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
    bottom: Platform.OS === 'web' ? 90 : SPACING.xl,
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
