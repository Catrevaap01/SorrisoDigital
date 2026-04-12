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
import { listarDentistasPorEspecialidade, obterCargaDentista } from '../../services/secretarioService';
import { atribuirTriagemADentista, buscarTriagemPorId } from '../../services/triagemService';
import { DentistaProfile } from '../../services/dentistaService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

type Props = NativeStackScreenProps<SecretarioStackParamList, 'AtribuirDentista'>;

interface DentistaComCarga extends DentistaProfile {
  cargaAtual?: number;
}

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

const AtribuirDentistaScreen: React.FC<Props> = ({ route, navigation }) => {
  const { triagemId, especialidadeSugerida } = route.params;
  const { profile } = useAuth();

  const [dentistas, setDentistas] = useState<DentistaComCarga[]>([]);
  const [loading, setLoading] = useState(true);
  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [especialidadeFiltro, setEspecialidadeFiltro] = useState(especialidadeSugerida || 'Todas');
  const [pacienteNome, setPacienteNome] = useState('');

  const carregarDados = useCallback(async () => {
    setLoading(true);

    // Buscar nome do paciente
    try {
      const triResult = await buscarTriagemPorId(triagemId);
      if (triResult.success && triResult.data) {
        setPacienteNome(triResult.data.paciente?.nome || 'Paciente');
      }
    } catch {
      /* ignore */
    }

    const esp = especialidadeFiltro === 'Todas' ? undefined : especialidadeFiltro;
    const res = await listarDentistasPorEspecialidade(esp);
    if (res.success && res.data) {
      // Buscar carga de cada dentista em parallel
      const comCarga = await Promise.all(
        res.data.map(async (d) => {
          const cargaRes = await obterCargaDentista(d.id);
          return { ...d, cargaAtual: cargaRes.count ?? 0 } as DentistaComCarga;
        })
      );
      // Ordenar: menos carga primeiro
      comCarga.sort((a, b) => (a.cargaAtual ?? 0) - (b.cargaAtual ?? 0));
      setDentistas(comCarga);
    }
    setLoading(false);
  }, [triagemId, especialidadeFiltro]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleAtribuir = (dentista: DentistaComCarga) => {
    const confirmar = async () => {
      setAtribuindo(dentista.id);
      const res = await atribuirTriagemADentista(triagemId, dentista.id, profile?.id);
      setAtribuindo(null);
      if (res.success) {
        Toast.show({
          type: 'success',
          text1: 'Caso atribuído!',
          text2: `Atribuído a Dr(a). ${dentista.nome}`,
        });
        navigation.goBack();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao atribuir',
          text2: 'Tente novamente',
        });
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Atribuir caso de ${pacienteNome} a Dr(a). ${dentista.nome}?`)) {
        confirmar();
      }
    } else {
      Alert.alert(
        'Atribuir caso',
        `Atribuir o caso de ${pacienteNome} a Dr(a). ${dentista.nome}?`,
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

  const getCargaCor = (carga: number) => {
    if (carga === 0) return COLORS.success;
    if (carga <= 3) return COLORS.primary;
    if (carga <= 6) return '#F97316';
    return COLORS.danger;
  };

  const renderDentista = ({ item }: { item: DentistaComCarga }) => {
    const carga = item.cargaAtual ?? 0;
    const cargaCor = getCargaCor(carga);
    const isAtribuindo = atribuindo === item.id;

    return (
      <View style={styles.dentCard}>
        <View style={styles.dentAvatar}>
          <Ionicons name="person-circle-outline" size={38} color={COLORS.primary} />
        </View>
        <View style={styles.dentInfo}>
          <Text style={styles.dentNome}>Dr(a). {item.nome || '—'}</Text>
          <Text style={styles.dentEsp}>{item.especialidade || 'Clínica Geral'}</Text>
          <View style={styles.cargaRow}>
            <View style={[styles.cargaDot, { backgroundColor: cargaCor }]} />
            <Text style={[styles.cargaText, { color: cargaCor }]}>
              {carga === 0 ? 'Livre' : `${carga} caso${carga !== 1 ? 's' : ''} activos`}
            </Text>
          </View>
          {item.telefone ? (
            <Text style={styles.dentTel}>
              <Ionicons name="call-outline" size={11} /> {item.telefone}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.atribuirBtn, isAtribuindo && { opacity: 0.6 }]}
          onPress={() => handleAtribuir(item)}
          disabled={!!atribuindo}
        >
          {isAtribuindo ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color="white" />
              <Text style={styles.atribuirBtnText}>Atribuir</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const header = (
    <View>
      {/* Caso info */}
      <View style={styles.casoInfo}>
        <Ionicons name="person-outline" size={18} color={COLORS.primary} />
        <Text style={styles.casoInfoText}>
          Atribuir caso de <Text style={{ fontWeight: '700' }}>{pacienteNome}</Text>
        </Text>
      </View>

      {/* Busca */}
      <View style={styles.buscaContainer}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Pesquisar dentista ou especialidade..."
          placeholderTextColor={COLORS.textSecondary}
          value={busca}
          onChangeText={setBusca}
        />
      </View>

      {/* Filtro especialidade */}
      <FlatList
        data={ESPECIALIDADES}
        keyExtractor={(e) => e}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.espFiltros}
        renderItem={({ item: esp }) => (
          <TouchableOpacity
            style={[styles.espBtn, especialidadeFiltro === esp && styles.espBtnActive]}
            onPress={() => setEspecialidadeFiltro(esp)}
          >
            <Text style={[styles.espBtnText, especialidadeFiltro === esp && styles.espBtnTextActive]}>
              {esp}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Text style={styles.countText}>
        {dentistasExibidos.length} dentista{dentistasExibidos.length !== 1 ? 's' : ''} disponível{dentistasExibidos.length !== 1 ? 'is' : ''}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>A carregar dentistas...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={dentistasExibidos}
      keyExtractor={(item) => item.id}
      renderItem={renderDentista}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.loadingText}>Nenhum dentista encontrado</Text>
        </View>
      }
      contentContainerStyle={[
        styles.content,
        Platform.OS === 'web' && styles.webContent,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  webContent: { maxWidth: 860, width: '100%', alignSelf: 'center' as const },

  casoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    margin: SIZES.md,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  casoInfoText: { flex: 1, fontSize: SIZES.fontMd, color: COLORS.text },

  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    padding: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  buscaInput: {
    flex: 1,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    paddingVertical: 4,
  },

  espFiltros: { paddingHorizontal: SIZES.md, gap: SIZES.sm, paddingBottom: SIZES.sm },
  espBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  espBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  espBtnText: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary },
  espBtnTextActive: { color: 'white' },

  countText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  dentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    gap: SIZES.sm,
    ...SHADOWS.sm,
  },
  dentAvatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  dentInfo: { flex: 1 },
  dentNome: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text },
  dentEsp: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginTop: 1 },
  dentTel: { fontSize: SIZES.fontXs, color: COLORS.textSecondary, marginTop: 2 },
  cargaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  cargaDot: { width: 8, height: 8, borderRadius: 4 },
  cargaText: { fontSize: SIZES.fontXs, fontWeight: '700' },

  atribuirBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  atribuirBtnText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontSm },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: SIZES.fontMd },
});

export default AtribuirDentistaScreen;
