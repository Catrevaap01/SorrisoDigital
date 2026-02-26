import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTodasTriagens, buscarContadores } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, PRIORIDADE } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { DentistaTabParamList } from '../../navigation/types';

type DashboardProps = BottomTabScreenProps<DentistaTabParamList, 'Dashboard'>;

const DashboardScreen: React.FC<DashboardProps> = ({ navigation }) => {
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<any[]>([]);
  const [contadores, setContadores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filtroAtivo, setFiltroAtivo] = useState<string>('pendente');

  const carregarDados = async () => {
    const [triagensResult, contadoresResult] = await Promise.all([
      buscarTodasTriagens({ status: filtroAtivo === 'todos' ? null : filtroAtivo }),
      buscarContadores(),
    ]);

    if (triagensResult.success) {
      setTriagens(triagensResult.data);
    }
    if (contadoresResult.success) {
      setContadores(contadoresResult.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, [filtroAtivo]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [filtroAtivo]);

  const filtros = [
    { id: 'pendente', label: 'Pendentes', count: contadores.pendente || 0 },
    { id: 'urgente', label: 'Urgentes', count: contadores.urgente || 0 },
    { id: 'respondido', label: 'Respondidos', count: contadores.respondido || 0 },
    { id: 'todos', label: 'Todos', count: contadores.total || 0 },
  ];

  const abrirCaso = (triagem) => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      parentNav.navigate('CasoDetalhe' as any, { triagemId: triagem.id });
    }
  };

  const renderContadores = () => (
    <View style={styles.contadoresContainer}>
      <View style={styles.contadorCard}>
        <Text style={[styles.contadorNumero, { color: '#FFA726' }]}>
          {contadores.pendente || 0}
        </Text>
        <Text style={styles.contadorLabel}>Pendentes</Text>
      </View>
      <View style={styles.contadorCard}>
        <Text style={[styles.contadorNumero, { color: '#EF5350' }]}>
          {contadores.urgente || 0}
        </Text>
        <Text style={styles.contadorLabel}>Urgentes</Text>
      </View>
      <View style={styles.contadorCard}>
        <Text style={[styles.contadorNumero, { color: '#66BB6A' }]}>
          {contadores.respondido || 0}
        </Text>
        <Text style={styles.contadorLabel}>Respondidos</Text>
      </View>
      <View style={styles.contadorCard}>
        <Text style={[styles.contadorNumero, { color: COLORS.primary }]}>
          {contadores.total || 0}
        </Text>
        <Text style={styles.contadorLabel}>Total</Text>
      </View>
    </View>
  );

  const renderTriagem = ({ item }) => {
    const statusInfo = STATUS_TRIAGEM[item.status] || STATUS_TRIAGEM.pendente;
    const prioridadeInfo = PRIORIDADE[item.prioridade] || PRIORIDADE.normal;
    const temResposta = item.respostas && item.respostas.length > 0;
    const dorAlta = item.intensidade_dor >= 7;

    return (
      <TouchableOpacity
        style={[styles.card, item.status === 'urgente' && styles.cardUrgente]}
        onPress={() => abrirCaso(item)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.pacienteInfo}>
            <Text style={styles.pacienteNome}>{item.paciente?.nome || 'Paciente'}</Text>
            <Text style={styles.pacienteDetalhe}>
              {item.paciente?.provincia || 'Angola'} • {formatRelativeTime(item.created_at)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Sintoma e Info */}
        <View style={styles.sintomaRow}>
          <Ionicons name="medical" size={20} color={COLORS.secondary} />
          <Text style={styles.sintomaText}>{item.sintoma_principal}</Text>
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
          <View style={[styles.tag, { backgroundColor: prioridadeInfo.color + '20' }]}>
            <Text style={[styles.tagText, { color: prioridadeInfo.color }]}>
              {prioridadeInfo.label}
            </Text>
          </View>

          {dorAlta && (
            <View style={[styles.tag, { backgroundColor: COLORS.danger + '20' }]}>
              <Ionicons name="alert" size={12} color={COLORS.danger} />
              <Text style={[styles.tagText, { color: COLORS.danger, marginLeft: 4 }]}>
                Dor {item.intensidade_dor}/10
              </Text>
            </View>
          )}

          {item.imagens && item.imagens.length > 0 && (
            <View style={[styles.tag, { backgroundColor: COLORS.primary + '20' }]}>
              <Ionicons name="images" size={12} color={COLORS.primary} />
              <Text style={[styles.tagText, { color: COLORS.primary, marginLeft: 4 }]}>
                {item.imagens.length} foto(s)
              </Text>
            </View>
          )}
        </View>

        {/* Preview de imagens */}
        {item.imagens && item.imagens.length > 0 && (
          <View style={styles.imagensRow}>
            {item.imagens.slice(0, 3).map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.imagemMini} />
            ))}
            {item.imagens.length > 3 && (
              <View style={styles.maisImagensBox}>
                <Text style={styles.maisImagensText}>+{item.imagens.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {temResposta ? '✓ Respondido' : 'Aguardando análise'}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Contadores */}
      {renderContadores()}

      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        {filtros.map((filtro) => (
          <TouchableOpacity
            key={filtro.id}
            style={[
              styles.filtroButton,
              filtroAtivo === filtro.id && styles.filtroButtonActive,
            ]}
            onPress={() => setFiltroAtivo(filtro.id)}
          >
            <Text
              style={[
                styles.filtroText,
                filtroAtivo === filtro.id && styles.filtroTextActive,
              ]}
            >
              {filtro.label}
            </Text>
            <View style={[
              styles.filtroBadge,
              filtroAtivo === filtro.id && styles.filtroBadgeActive,
            ]}>
              <Text style={[
                styles.filtroBadgeText,
                filtroAtivo === filtro.id && styles.filtroBadgeTextActive,
              ]}>
                {filtro.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Carregando casos...</Text>
        </View>
      ) : triagens.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="checkmark-circle" size={64} color={COLORS.secondary} />
          <Text style={styles.emptyTitle}>Nenhum caso {filtroAtivo}</Text>
          <Text style={styles.emptySubtitle}>
            {filtroAtivo === 'pendente' 
              ? 'Todos os casos foram analisados!'
              : 'Não há casos com esse filtro'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={triagens}
          keyExtractor={(item) => item.id}
          renderItem={renderTriagem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
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
  contadoresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.md,
    ...SHADOWS.sm,
  },
  contadorCard: {
    alignItems: 'center',
  },
  contadorNumero: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  contadorLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  filtrosContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  filtroButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.sm,
    marginHorizontal: 2,
    borderRadius: SIZES.radiusSm,
  },
  filtroButtonActive: {
    backgroundColor: COLORS.secondary + '15',
  },
  filtroText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  filtroTextActive: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  filtroBadge: {
    backgroundColor: COLORS.divider,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  filtroBadgeActive: {
    backgroundColor: COLORS.secondary,
  },
  filtroBadgeText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  filtroBadgeTextActive: {
    color: COLORS.textInverse,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.md,
  },
  emptySubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  lista: {
    padding: SIZES.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  cardUrgente: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SIZES.sm,
  },
  pacienteInfo: {
    flex: 1,
  },
  pacienteNome: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pacienteDetalhe: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
  },
  statusText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontXs,
    fontWeight: 'bold',
  },
  sintomaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  sintomaText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SIZES.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: SIZES.radiusSm,
    marginRight: SIZES.xs,
    marginBottom: SIZES.xs,
  },
  tagText: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
  },
  imagensRow: {
    flexDirection: 'row',
    marginBottom: SIZES.sm,
  },
  imagemMini: {
    width: 50,
    height: 50,
    borderRadius: SIZES.radiusSm,
    marginRight: SIZES.xs,
  },
  maisImagensBox: {
    width: 50,
    height: 50,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maisImagensText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SIZES.sm,
  },
  footerText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
});

export default DashboardScreen;