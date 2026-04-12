import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useDentist } from '../../contexts/DentistContext';
import { useAuth } from '../../contexts/AuthContext';
import { DentistaProfile, listarDentistas } from '../../services/dentistaService';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PacienteStackParamList } from '../../navigation/types';

type ChooseDentistaProps = NativeStackScreenProps<any, any>;

const ChooseDentistaScreen: React.FC<ChooseDentistaProps> = ({ navigation }) => {
  const { profile } = useAuth();
  const { selectDentist } = useDentist();
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const load = async (showSpinner: boolean) => {
    if (showSpinner) {
      setLoading(true);
    }

    let result = await listarDentistas({ forceRefresh: true });
    if ((result.data?.length || 0) === 0) {
      // Segunda tentativa para lidar com latencia de criacao/replicacao.
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

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      const isPaciente = profile?.tipo === 'paciente';
      if (!isPaciente) {
        Toast.show({
          type: 'info',
          text1: 'Acesso restrito',
          text2: 'Esta tela e exclusiva para pacientes',
        });
        navigation.goBack();
        return undefined;
      }

      // Primeira carga mostra spinner; recargas posteriores atualizam em background.
      void load(dentistas.length === 0);
      return undefined;
    }, [dentistas.length, navigation, profile?.tipo])
  );

  const handleSelect = async (d: DentistaProfile) => {
    if (!d.id) {
      Toast.show({ type: 'error', text1: 'Dentista invalido' });
      return;
    }
    await selectDentist({ id: d.id, nome: d.nome, foto_url: d.foto_url });
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Escolha um dentista</Text>
      <FlatList
        data={dentistas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          Platform.OS === 'web' && styles.webListContent
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.nome?.charAt(0).toUpperCase() || 'D'}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.nome || 'Dentista'}</Text>
              <Text style={styles.specialty}>{item.especialidade || 'Odontologia'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>Nenhum dentista disponivel</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  title: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    margin: SPACING.md,
    color: COLORS.text,
    textAlign: Platform.OS === 'web' ? 'center' : 'left',
  },
  listContent: { paddingBottom: 20 },
  webListContent: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 100,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginHorizontal: Platform.OS === 'web' ? SPACING.md : 0,
    backgroundColor: COLORS.surface,
    borderRadius: Platform.OS === 'web' ? 12 : 0,
    marginBottom: Platform.OS === 'web' ? SPACING.sm : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderBottomColor: COLORS.border,
    ...Platform.OS === 'web' ? SHADOWS.sm : {},
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: COLORS.textInverse, fontWeight: '700' },
  info: { flex: 1, marginLeft: SPACING.md },
  name: { color: COLORS.text, fontSize: TYPOGRAPHY.sizes.md, fontWeight: '600' },
  specialty: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.sizes.sm, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.sizes.md },
});

export default ChooseDentistaScreen;
