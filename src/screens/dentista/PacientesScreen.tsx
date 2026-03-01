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
import { listarPacientes, PacienteProfile } from '../../services/pacienteService';
import { obterOuCriarConversa } from '../../services/messagesService';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import type { DentistaTabParamList } from '../../navigation/types';

const PacientesScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<DentistaTabParamList>>();
  const { user, profile } = useAuth();

  const [pacientes, setPacientes] = useState<PacienteProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const result = await listarPacientes();
      if (result.success && result.data) {
        setPacientes(result.data);
      } else {
        Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Não foi possível carregar pacientes' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const iniciarChat = async (paciente: PacienteProfile) => {
    if (!user?.id || !profile?.nome) return;
    setLoadingChatId(paciente.id);

    const res = await obterOuCriarConversa(
      user.id,
      paciente.id,
      profile.nome,
      paciente.nome || 'Paciente',
      profile.foto_url || null,
      paciente.foto_url || null
    );

    setLoadingChatId(null);

    if (res.success && res.data) {
      navigation.navigate('Mensagens', {
        openConversationId: res.data.id,
        otherUserName: paciente.nome || 'Paciente',
        otherUserAvatar: paciente.foto_url,
      });
    } else {
      Toast.show({ type: 'error', text1: 'Erro', text2: res.error || 'Não foi possível iniciar conversa' });
    }
  };

  const renderItem = ({ item }: { item: PacienteProfile }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => iniciarChat(item)}
      disabled={loadingChatId === item.id}
    >
      <View>
        <Text style={styles.name}>{item.nome || 'Paciente'}</Text>
        {item.provincia ? (
          <Text style={styles.sub}>{item.provincia}</Text>
        ) : null}
      </View>
      {loadingChatId === item.id && <ActivityIndicator color={COLORS.secondary} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.secondary} />
      ) : (
        <FlatList
          data={pacientes}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum paciente encontrado</Text>
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

export default PacientesScreen;
