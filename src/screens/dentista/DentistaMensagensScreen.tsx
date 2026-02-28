import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DentistaTabParamList } from '../../navigation/types';
import ConversationsListScreen from '../shared/ConversationsListScreen';
import ChatScreen from '../shared/ChatScreen';

type Props = BottomTabScreenProps<DentistaTabParamList, 'Mensagens'>;

const DentistaMensagensScreen: React.FC<Props> = ({ route }) => {
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [outroNome, setOutroNome] = useState('');
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

  useEffect(() => {
    if (route.params?.openConversationId) {
      setConversaSelecionada(route.params.openConversationId);
      setOutroNome(route.params.otherUserName || 'Paciente');
      setOutroAvatar(route.params.otherUserAvatar);
    }
  }, [route.params]);

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default DentistaMensagensScreen;
