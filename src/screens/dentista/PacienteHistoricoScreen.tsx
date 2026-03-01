import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTriagensPaciente } from '../../services/triagemService';
import { buscarPaciente, PacienteProfile } from '../../services/pacienteService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM } from '../../utils/constants';
import { formatRelativeTime, formatDateTime } from '../../utils/helpers';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';

type PacienteHistoricoProps = NativeStackScreenProps<
  DentistaStackParamList,
  'PacienteHistorico'
>;

const PacienteHistoricoScreen: React.FC<PacienteHistoricoProps> = ({
  route,
  navigation,
}) => {
  const { pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [paciente, setPaciente] = useState<PacienteProfile | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    if (pacienteId) {
      const [tResult, pResult] = await Promise.all([
        buscarTriagensPaciente(pacienteId),
        buscarPaciente(pacienteId),
      ]);
      if (tResult.success && tResult.data) {
        setTriagens(tResult.data);
      }
      if (pResult.success && pResult.data) {
        setPaciente(pResult.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, [pacienteId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [pacienteId]);

  const renderTriagemLinha = ({ item }) => {
    const statusInfo = STATUS_TRIAGEM[item.status] || STATUS_TRIAGEM.pendente;
    return (
      <TouchableOpacity
        style={styles.rowItem}
        onPress={() =>
          navigation.navigate('CasoDetalhe' as any, { triagemId: item.id })
        }
        activeOpacity={0.7}
      >
        <View
          style={[styles.rowStatusDot, { backgroundColor: statusInfo.color }]}
        />
        <View style={styles.rowMain}>
          <Text style={styles.rowTitulo} numberOfLines={1}>
            {item.sintoma_principal || 'Sem descrição'}
          </Text>
          <Text style={styles.rowSubtitulo} numberOfLines={1}>
            {statusInfo.label} | Dor {item.intensidade_dor}/10 |{' '}
            {formatRelativeTime(item.created_at)}{' '}
            •{' '}
            {new Date(item.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderPacienteInfo = () => {
    if (!paciente) return null;
    return (
      <View style={styles.pacienteInfoSection}>
        <Text style={styles.sectionTitle}>Dados do Paciente</Text>
        {paciente.data_nascimento && (
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Nascimento: </Text>
            {formatDateTime(paciente.data_nascimento)}
          </Text>
        )}
        {paciente.genero && (
          <Text style={styles.infoText}>
            <Text style={styles.infoLabel}>Gênero: </Text>
            {paciente.genero}
          </Text>
        )}
        {paciente.historico_medico && (
          <Text style={styles.infoText} numberOfLines={3}>
            <Text style={styles.infoLabel}>Histórico médico: </Text>
            {paciente.historico_medico}
          </Text>
        )}
        {paciente.alergias && (
          <Text style={styles.infoText} numberOfLines={2}>
            <Text style={styles.infoLabel}>Alergias: </Text>
            {paciente.alergias}
          </Text>
        )}
        {paciente.medicamentos_atuais && (
          <Text style={styles.infoText} numberOfLines={2}>
            <Text style={styles.infoLabel}>Medicamentos: </Text>
            {paciente.medicamentos_atuais}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* header com nome */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          Histórico de {pacienteNome || 'Paciente'}
        </Text>
      </View>
      {renderPacienteInfo()}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      ) : triagens.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons
            name="document-text-outline"
            size={64}
            color={COLORS.textLight}
          />
          <Text style={styles.emptyTitle}>Nenhum histórico encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={triagens}
          keyExtractor={(item) => item.id}
          renderItem={renderTriagemLinha}
          contentContainerStyle={styles.listaLinhas}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: {
    padding: SIZES.md,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  headerTitle: { fontSize: SIZES.fontLg, fontWeight: 'bold', color: COLORS.text },
  pacienteInfoSection: {
    padding: SIZES.md,
    backgroundColor: COLORS.surface,
    marginBottom: SIZES.sm,
  },
  sectionTitle: { fontSize: SIZES.fontMd, fontWeight: '600', marginBottom: SIZES.xs },
  infoLabel: { fontWeight: '500', color: COLORS.textSecondary },
  infoText: { fontSize: SIZES.fontSm, marginTop: 2, color: COLORS.text },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, marginTop: SIZES.md },
  emptyTitle: { fontSize: SIZES.fontLg, color: COLORS.textSecondary, marginTop: SIZES.md },
  listaLinhas: { paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  rowStatusDot: { width: 10, height: 10, borderRadius: 5, marginRight: SIZES.sm },
  rowMain: { flex: 1 },
  rowTitulo: { fontSize: SIZES.fontMd, fontWeight: '600', color: COLORS.text },
  rowSubtitulo: { marginTop: 2, fontSize: SIZES.fontSm, color: COLORS.textSecondary },
  rowSeparator: { height: SIZES.sm },
});

export default PacienteHistoricoScreen;
