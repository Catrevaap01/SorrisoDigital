import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buscarTriagensPaciente, Triagem } from '../../services/triagemService';
import { buscarPaciente, PacienteProfile, calcularIdade } from '../../services/pacienteService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM } from '../../utils/constants';
import { formatRelativeTime, formatDate } from '../../utils/helpers';
import { exportarHistoricoPacientePdf } from '../../services/pdfReportService';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';
import { SecretarioStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import QRCode from 'react-native-qrcode-svg';
import Constants from 'expo-constants';

type PacienteHistoricoProps = NativeStackScreenProps<
  DentistaStackParamList | SecretarioStackParamList,
  'PacienteHistorico'
>;

const PacienteHistoricoScreen: React.FC<PacienteHistoricoProps> = ({
  route,
  navigation,
}) => {
  const { pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [paciente, setPaciente] = useState<PacienteProfile | null>(null);
  const [exporting, setExporting] = useState(false);

  const carregarDados = useCallback(async () => {
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
  }, [pacienteId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  useRealtimeRefresh({
    enabled: !!pacienteId,
    debounceMs: 600,
    shouldRefresh: (event) => {
      if (!pacienteId) return false;
      if (event.table === 'triagens') {
        const pid = String(event.new?.paciente_id || event.old?.paciente_id || '');
        return pid === pacienteId;
      }
      if (event.table === 'profiles') {
        const id = String(event.new?.id || event.old?.id || '');
        return id === pacienteId;
      }
      if (event.table === 'respostas_triagem') {
        return true; // garante que status/response reflita imediatamente
      }
      return false;
    },
    refresh: () => {
      carregarDados();
    },
  });

  const renderTriagemLinha = ({ item }: { item: Triagem }) => {
    const temResposta = item.respostas && item.respostas.length > 0;
    const isRealizado = item.status === 'realizado' || item.agendamento_status === 'realizado';
    const isUrg = item.status === 'urgente' || item.prioridade === 'urgente' || item.prioridade === 'alta' || Number(item.intensidade_dor || 0) > 6;
    
    const effectiveStatus = isRealizado
      ? 'realizado'
      : temResposta
        ? 'respondido'
        : isUrg
          ? 'urgente'
          : item.status || 'pendente';
          
    const statusInfo = STATUS_TRIAGEM[effectiveStatus] || STATUS_TRIAGEM.pendente;

    const isSecretario = profile?.tipo === 'secretario';

    const imagens = Array.isArray(item.imagens)
      ? item.imagens
      : (item.imagens && typeof item.imagens === 'string'
        ? [item.imagens]
        : []);
    const temImagens = imagens.length > 0;

    return (
      <TouchableOpacity
        style={styles.rowItem}
        onPress={() => {
          if (!isSecretario) {
            navigation.getParent()?.navigate('CasoDetalhe', { triagemId: item.id });
          }
        }}
        activeOpacity={isSecretario ? 1 : 0.7}
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
            {item.created_at ? formatRelativeTime(item.created_at) : 'N/A'}{' '}
            •{' '}
            {item.created_at ? new Date(item.created_at).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }) : 'N/A'}
          </Text>
        </View>
        {temImagens && (
          <View style={styles.rowThumbnailContainer}>
            <Image source={{ uri: imagens[0] }} style={styles.rowThumbnail} />
            {imagens.length > 1 && (
              <View style={styles.rowImgCountBadge}>
                <Text style={styles.rowImgCountText}>+{imagens.length}</Text>
              </View>
            )}
          </View>
        )}
        {!isSecretario && (
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  const renderPacienteInfo = () => {
    if (!paciente) return null;
    return (
      <View style={styles.pacienteInfoSection}>
        <Text style={styles.sectionTitle}>Dados do Paciente</Text>
        {paciente.data_nascimento && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.infoText}>
              <Text style={styles.infoLabel}>Nascimento: </Text>
              {formatDate(paciente.data_nascimento)}
            </Text>
            <Text style={[styles.infoText, { color: COLORS.secondary, fontWeight: 'bold' }]}>
              ({calcularIdade(paciente.data_nascimento)} anos)
            </Text>
          </View>
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

        <View style={styles.qrContainer}>
          <Text style={styles.qrTitle}>QR-instalar o app</Text>
          <View style={styles.qrWrapper}>
            <QRCode
              value={Constants.expoConfig?.extra?.APK_DOWNLOAD_URL || 'https://expo.dev/@antoniotati/TeOdontoAngola'}
              size={120}
              color={COLORS.primary}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header com nome */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          Histórico de {pacienteNome || 'Paciente'}
        </Text>
        <TouchableOpacity
          style={styles.pdfBtn}
          onPress={async () => {
            setExporting(true);
            const res = await exportarHistoricoPacientePdf(pacienteId);
            setExporting(false);
            if (!res.success) {
              Toast.show({ type: 'error', text1: 'Erro', text2: res.error || 'Falha ao gerar PDF' });
            }
          }}
          disabled={exporting}
        >
          <Ionicons name="download" size={18} color={COLORS.primary} />
          <Text style={styles.pdfBtnText}>{exporting ? 'Gerando...' : 'PDF'}</Text>
        </TouchableOpacity>
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
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>Nenhum histórico encontrado</Text>
        </View>
      ) : (
        <FlatList
          data={triagens}
          keyExtractor={(item: any) => item.id}
          renderItem={renderTriagemLinha}
          contentContainerStyle={styles.listaLinhas}
          refreshControl={Platform.OS !== 'web' ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  headerTitle: { fontSize: SIZES.fontLg, fontWeight: 'bold', color: COLORS.text, flex: 1 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pdfBtnText: { color: COLORS.primary, fontSize: SIZES.fontSm, fontWeight: '700' },
  pacienteInfoSection: {
    padding: SIZES.md,
    backgroundColor: COLORS.surface,
    marginBottom: SIZES.sm,
  },
  sectionTitle: { fontSize: SIZES.fontMd, fontWeight: '600', marginBottom: SIZES.xs },
  infoLabel: { fontWeight: '500', color: COLORS.textSecondary },
  infoText: { fontSize: SIZES.fontSm, marginTop: 2, color: COLORS.text },
  qrContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: SIZES.md,
    marginTop: SIZES.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: SIZES.md,
  },
  qrWrapper: { padding: 4, backgroundColor: 'white', borderRadius: 8 },
  qrTitle: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.primary },
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
  rowThumbnailContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: SIZES.sm,
    backgroundColor: COLORS.divider,
  },
  rowThumbnail: {
    width: '100%',
    height: '100%',
  },
  rowImgCountBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowImgCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rowSeparator: { height: SIZES.sm },
});

export default PacienteHistoricoScreen;
