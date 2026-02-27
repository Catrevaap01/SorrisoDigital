/**
 * Tela de Mensagens do Dentista
 * Lista de conversas com pacientes
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ConversationsListScreen from '../shared/ConversationsListScreen';
import ChatScreen from '../shared/ChatScreen';

const DentistaMensagensScreen: React.FC = () => {
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState<string>('');
  const [outroAvatar, setOutroAvatar] = useState<string | undefined>(undefined);

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

  if (conversaSelecionada) {
    return (
      <View style={styles.container}>
        <ChatScreen
          conversationId={conversaSelecionada}
          otherUserName={outroNome}
          otherUserAvatar={outroAvatar}
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

export default DentistaMensagensScreen;
