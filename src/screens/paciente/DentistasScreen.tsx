import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../../contexts/AuthContext';
import { listarDentistas, DentistaProfile } from '../../services/dentistaService';
import { obterOuCriarConversa } from '../../services/messagesService';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import type { PacienteTabParamList } from '../../navigation/types';

const DentistasScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<PacienteTabParamList>>();
  const { user, profile } = useAuth();

  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const result = await listarDentistas();
      if (result.success && result.data) {
        setDentistas(result.data);
      } else {
        Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Não foi possível carregar dentistas' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const iniciarChat = async (dentista: DentistaProfile) => {
    if (!user?.id || !profile?.nome) return;
    setLoadingChatId(dentista.id);

    const res = await obterOuCriarConversa(
      user.id,
      dentista.id,
      profile.nome,
      dentista.nome || 'Dentista',
      profile.foto_url || null,
      dentista.foto_url || null
    );

    setLoadingChatId(null);

    if (res.success && res.data) {
      navigation.navigate('Mensagens', {
        openConversationId: res.data.id,
        otherUserName: dentista.nome || 'Dentista',
        otherUserAvatar: dentista.foto_url,
      });
    } else {
      Toast.show({ type: 'error', text1: 'Erro', text2: res.error || 'Não foi possível iniciar conversa' });
    }
  };

  const renderItem = ({ item }: { item: DentistaProfile }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => iniciarChat(item)}
      disabled={loadingChatId === item.id}
    >
      <View>
        <Text style={styles.name}>{item.nome || 'Dentista'}</Text>
        {item.especialidade ? (
          <Text style={styles.sub}>{item.especialidade}</Text>
        ) : null}
      </View>
      {loadingChatId === item.id && <ActivityIndicator color={COLORS.primary} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={dentistas}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum dentista encontrado</Text>
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
  list: {
    padding: SPACING.lg,
  },
  card: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: '600',
    color: COLORS.text,
  },
  sub: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
  },
  empty: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    color: COLORS.textSecondary,
  },
});

export default DentistasScreen;
