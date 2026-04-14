import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SecretarioStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { listarDentistasPorEspecialidade, atribuirAgendamentoAoDentista } from '../../services/secretarioService';
import { buscarAgendamentoPorId, Agendamento } from '../../services/agendamentoService';
import { DentistaProfile } from '../../services/dentistaService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDateTime } from '../../utils/helpers';

type Props = NativeStackScreenProps<SecretarioStackParamList, 'AtribuirAgendamento'>;

type DentistaComCarga = DentistaProfile & { cargaAtual?: number };

const ESPECIALIDADES = [
  'Todas',
  'Clínica Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia Oral',
  'Implantologia',
  'Estética',
];

const AtribuirDentistaAgendamentoScreen: React.FC<Props> = ({ route, navigation }) => {
  const { agendamentoId, especialidadeSugerida } = route.params;
  const { profile } = useAuth();

  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [dentistas, setDentistas] = useState<DentistaComCarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [especialidadeFiltro, setEspecialidadeFiltro] = useState(especialidadeSugerida || 'Todas');

  const carregarDados = useCallback(async () => {
    setLoading(true);

    const [agendaRes, listaRes] = await Promise.all([
      buscarAgendamentoPorId(agendamentoId),
      listarDentistasPorEspecialidade(especialidadeFiltro === 'Todas' ? undefined : especialidadeFiltro),
    ]);

    if (agendaRes.success && agendaRes.data) {
      setAgendamento(agendaRes.data);
    }

    if (listaRes.success && listaRes.data) {
      setDentistas(listaRes.data.map((d) => ({ ...d, cargaAtual: undefined })));
    }

    setLoading(false);
  }, [agendamentoId, especialidadeFiltro]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleAtribuir = (dentista: DentistaComCarga) => {
    const confirmar = async () => {
      setAtribuindo(dentista.id);
      // Usa atribuirAgendamentoAoDentista para:
      // - Registar secretario_id
      // - Definir status = 'atribuido_dentista'
      const res = await atribuirAgendamentoAoDentista(
        agendamentoId,
        dentista.id,
        profile?.id || '',
        undefined, // data definida pela secretaria (opcional)
        undefined, // hora definida pela secretaria (opcional)
        undefined, // observacoes
      );
      setAtribuindo(null);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Consulta atribuída!',
          text2: `Atribuído a Dr(a). ${dentista.nome}`,
        });
        navigation.goBack();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao pré-agendar',
          text2: 'Tente novamente',
        });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Pré-agendar esta consulta para Dr(a). ${dentista.nome}?`)) {
        confirmar();
      }
    } else {
      Alert.alert(
        'Pré-agendar consulta',
        `Deseja pré-agendar esta consulta para Dr(a). ${dentista.nome}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: confirmar },
        ]
      );
    }
  };

  const dentistasExibidos = dentistas.filter((d) => {
    const q = busca.toLowerCase();
    return (
      !busca ||
      (d.nome || '').toLowerCase().includes(q) ||
      (d.especialidade || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando dados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Solicitação do paciente</Text>
        <Text style={styles.infoText}>Paciente: {agendamento?.paciente?.nome || '—'}</Text>
        <Text style={styles.infoText}>Data preferida: {agendamento?.appointment_date ? formatDateTime(agendamento.appointment_date) : '—'}</Text>
        {agendamento?.notes ? (
          <Text style={styles.infoText}>Motivo: {agendamento.notes}</Text>
        ) : null}
      </View>

      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar dentista ou especialidade..."
          placeholderTextColor={COLORS.textSecondary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      <FlatList
        data={ESPECIALIDADES}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterButton, especialidadeFiltro === item && styles.filterButtonActive]}
            onPress={() => setEspecialidadeFiltro(item)}
          >
            <Text style={[styles.filterButtonText, especialidadeFiltro === item && styles.filterButtonTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {dentistasExibidos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Nenhum dentista encontrado</Text>
          <Text style={styles.emptyText}>Ajuste o filtro ou tente novamente mais tarde.</Text>
        </View>
      ) : (
        <FlatList
          data={dentistasExibidos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isAtribuindo = atribuindo === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.dentistaHeader}>
                  <View>
                    <Text style={styles.dentistaNome}>Dr(a). {item.nome || '—'}</Text>
                    <Text style={styles.dentistaEspecialidade}>{item.especialidade || 'Clínica Geral'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.assignButton, isAtribuindo && { opacity: 0.6 }]}
                    onPress={() => handleAtribuir(item)}
                    disabled={!!atribuindo}
                  >
                    {isAtribuindo ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.assignButtonText}>Pré-agendar</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.dentistaMeta}>
                  <Ionicons name="pulse-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {item.cargaAtual === undefined ? 'Carregamento indisponível' : `${item.cargaAtual} caso(s) ativos`}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SIZES.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  infoTitle: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.xs,
    fontSize: 16,
  },
  infoText: {
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: SIZES.md,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  filterList: {
    paddingBottom: SIZES.md,
  },
  filterButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SIZES.radiusLg,
    marginRight: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  dentistaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  dentistaNome: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dentistaEspecialidade: {
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  assignButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
  },
  assignButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  dentistaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SIZES.xl,
  },
  emptyTitle: {
    marginTop: SIZES.md,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: SIZES.sm,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  list: {
    paddingBottom: 40,
  },
});

export default AtribuirDentistaAgendamentoScreen;
