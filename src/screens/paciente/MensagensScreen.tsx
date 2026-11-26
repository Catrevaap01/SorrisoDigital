import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';
import ConversationsListScreen from '../shared/ConversationsListScreen';
import ChatScreen from '../shared/ChatScreen';
import { useAuth } from '../../contexts/AuthContext';

/**
 * MensagensScreen (Paciente)
 *
 * Ecrã de mensagens do paciente.
 * Delega a listagem de conversas e o modal de "Nova Conversa" para o ConversationsListScreen,
 * que exibe exclusivamente o Secretário e o Dentista atribuído ao paciente.
 */
const MensagensScreen: React.FC = () => {
  const { profile } = useAuth();
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState('');
  const [outroAvatar, setOutroAvatar] = useState<string | undefined>(undefined);
  const [outroUserId, setOutroUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (profile?.tipo && profile.tipo !== 'paciente') {
      Toast.show({
        type: 'info',
        text1: 'Acesso restrito',
        text2: 'Esta tela é exclusiva para pacientes',
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MensagensScreen;
