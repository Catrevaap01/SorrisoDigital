import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SecretarioTabParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import ConversationsListScreen from '../../screens/shared/ConversationsListScreen';
import ChatScreen from '../../screens/shared/ChatScreen';
import { listarDentistas, DentistaProfile } from '../../services/dentistaService';
import { listarPacientes, PacienteProfile } from '../../services/pacienteService';
import { obterOuCriarConversa } from '../../services/messagesService';

type Props = BottomTabScreenProps<SecretarioTabParamList, 'Mensagens'>;

const SecretarioMensagensScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user, profile } = useAuth();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState('');
  const [outroAvatar, setOutroAvatar] = useState<string | undefined>(undefined);
  
  // Modal para nova conversa
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [pacientes, setPacientes] = useState<PacienteProfile[]>([]);
  const [contatos, setContatos] = useState<(DentistaProfile | PacienteProfile)[]>([]);
  const [busca, setBusca] = useState('');

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

  // Carregar dentistas e pacientes para nova conversa
  const carregarContatos = async () => {
    setLoadingContatos(true);
    try {
      const [dentResult, pacResult] = await Promise.all([
        listarDentistas(),
        listarPacientes()
      ]);

      let allContatos: (DentistaProfile | PacienteProfile)[] = [];
      
      if (dentResult.success && dentResult.data) {
        allContatos.push(...dentResult.data);
      }
      if (pacResult.success && pacResult.data) {
        allContatos.push(...pacResult.data);
      }

      setDentistas(dentResult.data || []);
      setPacientes(pacResult.data || []);
      setContatos(allContatos);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Falha ao carregar contatos',
      });
    } finally {
      setLoadingContatos(false);
    }
  };

const iniciarConversa = async (contato: DentistaProfile | PacienteProfile) => {
  if (!user?.id || !profile?.nome || !contato.nome) return;
    if (!user?.id || !profile?.nome) return;

    try {
      const result = await obterOuCriarConversa(
        user.id,
        contato.id,
        profile.nome,
        contato.nome,
        profile.foto_url || null,
        (contato as any).foto_url || null
      );

      if (result.success && result.data) {
        setShowNovoModal(false);
      handleSelectConversa(result.data.id, contato.nome!, (contato as any).foto_url || undefined);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: result.error || 'Não foi possível iniciar conversa',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Falha ao criar conversa',
      });
    }
  };

  const handleBuscaContatos = (texto: string) => {
    setBusca(texto);
    if (!texto.trim()) {
      setContatos([...dentistas, ...pacientes]);
      return;
    }
    const filtrados = contatos.filter(c => 
      (c.nome || '').toLowerCase().includes(texto.toLowerCase())
    );
    setContatos(filtrados);
  };

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.openConversationId) {
        setConversaSelecionada(route.params.openConversationId);
        setOutroNome(route.params.otherUserName || 'Contacto');
        setOutroAvatar(route.params.otherUserAvatar);
      }
    }, [route.params])
  );

  if (conversaSelecionada) {
    return (
      <ChatScreen
        conversationId={conversaSelecionada}
        otherUserName={outroNome}
        otherUserAvatar={outroAvatar}
        onBack={handleBackFromChat}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ConversationsListScreen onSelectConversation={handleSelectConversa} />

      {/* FAB Nova Conversa */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => {
          setShowNovoModal(true);
          carregarContatos();
        }}
      >
        <Ionicons name="add" size={26} color="white" />
      </TouchableOpacity>

      {/* Modal Nova Conversa */}
      <Modal visible={showNovoModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Mensagem</Text>
              <TouchableOpacity onPress={() => setShowNovoModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar dentistas ou pacientes..."
                value={busca}
                onChangeText={handleBuscaContatos}
              />
            </View>

            {loadingContatos ? (
              <ActivityIndicator style={styles.loading} color="#6D28D9" size="large" />
            ) : (
                <FlatList
                  data={contatos}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }: { item: DentistaProfile | PacienteProfile }) => (
                  <TouchableOpacity style={styles.contatoItem} onPress={() => iniciarConversa(item)}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(item.nome || 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.contatoInfo}>
                      <Text style={styles.contatoNome}>{item.nome}</Text>
                      <Text style={styles.contatoTipo}>
                        { (item as any).tipo === 'dentista' ? 'Dentista' : 'Paciente' }
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </TouchableOpacity>
                )}
                style={styles.list}
                ListEmptyComponent={
                  <Text style={styles.emptyList}>Nenhum contacto encontrado</Text>
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
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'web' ? 90 : 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6D28D9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  loading: {
    marginTop: 40,
  },
  list: {
    flex: 1,
    marginHorizontal: 16,
  },
  contatoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6D28D9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contatoInfo: {
    flex: 1,
  },
  contatoNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contatoTipo: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  emptyList: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
    fontSize: 16,
  },
});

export default SecretarioMensagensScreen;

