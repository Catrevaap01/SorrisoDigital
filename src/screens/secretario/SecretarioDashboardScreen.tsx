import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SecretarioTabParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import useFilasSecretaria from '../../hooks/useFilasSecretaria';
import FilasList from '../../components/FilasList';
import TratamentosFacturasPanel from '../../components/TratamentosFacturasPanel';
import {
  buscarTratamentosFinanceirosSecretaria,
  recusarTriagem,
  rejeitarAgendamento,
  TratamentoFinanceiroItem,
} from '../../services/secretarioService';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { formatRelativeTime } from '../../utils/helpers';

type Props = BottomTabScreenProps<SecretarioTabParamList, 'SecretarioDashboard'>;

type ItemPainel = {
  id: string;
  tipo: 'triagem' | 'agendamento';
  titulo: string;
  descricao: string;
  created_at?: string;
  prioridade: string;
  raw: any;
};

type PainelTab = 'operacoes' | 'financeiro';

const SecretaryDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useAuth();
  const { filas, carregarFilas } = useFilasSecretaria();
  const [activeTab, setActiveTab] = useState<PainelTab>('operacoes');
  const [tratamentosFinanceiros, setTratamentosFinanceiros] = useState<TratamentoFinanceiroItem[]>([]);
  const [financeiroLoading, setFinanceiroLoading] = useState(false);

  const carregarFinanceiro = useCallback(async () => {
    setFinanceiroLoading(true);
    const result = await buscarTratamentosFinanceirosSecretaria();
    if (result.success) {
      setTratamentosFinanceiros(result.data || []);
    } else {
      Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao carregar tratamentos e facturas' });
      setTratamentosFinanceiros([]);
    }
    setFinanceiroLoading(false);
  }, []);

  const carregarPainel = useCallback(async () => {
    await Promise.all([carregarFilas(), carregarFinanceiro()]);
  }, [carregarFilas, carregarFinanceiro]);

  useFocusEffect(
    useCallback(() => {
      void carregarPainel();
    }, [carregarPainel])
  );

  const handleAtribuirTriagem = useCallback(
    (item: any) => {
      navigation.getParent()?.navigate(
        'AtribuirDentista',
        {
          triagemId: item.id,
          especialidadeSugerida: item.sintoma_principal,
        } as never
      );
    },
    [navigation]
  );

  const handleAtribuirAgendamento = useCallback(
    (item: any) => {
      navigation.getParent()?.navigate(
        'AtribuirAgendamento',
        {
          agendamentoId: item.id,
          especialidadeSugerida: item.symptoms,
        } as never
      );
    },
    [navigation]
  );

  const handleRejeitarTriagem = useCallback(
    (item: any) => {
      Alert.prompt?.(
        'Rejeitar triagem',
        'Informe o motivo da rejeição:',
        async (motivo) => {
          if (!motivo?.trim() || !profile?.id) return;
          const result = await recusarTriagem(item.id, profile.id, motivo.trim());
          if (result.success) {
            Toast.show({ type: 'success', text1: 'Triagem rejeitada' });
            await carregarFilas();
          } else {
            Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
          }
        }
      );
    },
    [carregarFilas, profile?.id]
  );

  const handleRejeitarAgendamento = useCallback(
    (item: any) => {
      Alert.prompt?.(
        'Rejeitar agendamento',
        'Informe o motivo da rejeição:',
        async (motivo) => {
          if (!motivo?.trim() || !profile?.id) return;
          const result = await rejeitarAgendamento(item.id, profile.id, motivo.trim());
          if (result.success) {
            Toast.show({ type: 'success', text1: 'Agendamento rejeitado' });
            await carregarFilas();
          } else {
            Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
          }
        }
      );
    },
    [carregarFilas, profile?.id]
  );

  const triagensOrdenadas = useMemo(
    () =>
      [...filas.triagensNovas].sort(
        (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ),
    [filas.triagensNovas]
  );

  const agendamentosOrdenados = useMemo(
    () =>
      [...filas.agendamentosNovos].sort(
        (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ),
    [filas.agendamentosNovos]
  );

  const itensCombinados = useMemo<ItemPainel[]>(
    () => [
      ...triagensOrdenadas.map((item: any) => ({
        id: `triagem-${item.id}`,
        tipo: 'triagem' as const,
        titulo: item.paciente?.nome || 'Paciente sem nome',
        descricao: item.sintoma_principal || 'Triagem recebida',
        created_at: item.created_at,
        prioridade: String(item.prioridade || item.intensidade_dor || 'normal'),
        raw: item,
      })),
      ...agendamentosOrdenados.map((item: any) => ({
        id: `agendamento-${item.id}`,
        tipo: 'agendamento' as const,
        titulo: item.paciente?.nome || 'Paciente sem nome',
        descricao: item.symptoms || 'Solicitação de consulta',
        created_at: item.created_at,
        prioridade: String(item.urgency || 'normal'),
        raw: item,
      })),
    ].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ),
    [agendamentosOrdenados, triagensOrdenadas]
  );

  const alertas = useMemo(
    () =>
      itensCombinados.filter((item) => {
        const prioridade = item.prioridade.toLowerCase();
        return prioridade === 'urgente' || prioridade === 'alta' || Number(prioridade) >= 8;
      }).slice(0, 4),
    [itensCombinados]
  );

  const retornos = useMemo(
    () =>
      itensCombinados.filter((item) => {
        const createdAt = item.created_at ? new Date(item.created_at).getTime() : 0;
        const diffHours = (Date.now() - createdAt) / (1000 * 60 * 60);
        return diffHours >= 12;
      }).slice(0, 4),
    [itensCombinados]
  );

  const historico = useMemo(() => itensCombinados.slice(0, 8), [itensCombinados]);
  const novasSolicitacoes = useMemo(() => itensCombinados.slice(0, 5), [itensCombinados]);

  const metricas = useMemo(
    () => [
      {
        label: 'Novas solicitações',
        value: filas.contadores.total,
        icon: 'mail-unread-outline',
        color: '#6D28D9',
      },
      {
        label: 'Triagens',
        value: filas.contadores.triagensNovas,
        icon: 'pulse-outline',
        color: '#0F766E',
      },
      {
        label: 'Agenda',
        value: filas.contadores.agendamentosNovos,
        icon: 'calendar-outline',
        color: '#2563EB',
      },
      {
        label: 'Alertas',
        value: alertas.length,
        icon: 'warning-outline',
        color: '#DC2626',
      },
      {
        label: 'Retornos',
        value: retornos.length,
        icon: 'return-up-back-outline',
        color: '#D97706',
      },
    ],
    [alertas.length, filas.contadores.agendamentosNovos, filas.contadores.total, filas.contadores.triagensNovas, retornos.length]
  );

  const renderBadge = (tipo: 'triagem' | 'agendamento') => (
    <View style={[styles.badge, tipo === 'triagem' ? styles.badgeTriagem : styles.badgeAgenda]}>
      <Text style={[styles.badgeText, tipo === 'triagem' ? styles.badgeTextTriagem : styles.badgeTextAgenda]}>
        {tipo === 'triagem' ? 'Triagem' : 'Agenda'}
      </Text>
    </View>
  );

  const renderMiniList = (
    titulo: string,
    subtitulo: string,
    items: ItemPainel[],
    emptyText: string
  ) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{titulo}</Text>
      <Text style={styles.cardSubtitle}>{subtitulo}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        items.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <View style={styles.listItemTop}>
                <View style={styles.patientBlock}>
                  <Text style={styles.patientLabel}>Paciente</Text>
                  <Text style={styles.listItemTitle}>{item.titulo}</Text>
                </View>
                {renderBadge(item.tipo)}
              </View>
            <Text style={styles.listItemDesc} numberOfLines={2}>{item.descricao}</Text>
            <Text style={styles.listItemMeta}>{formatRelativeTime(item.created_at || new Date().toISOString())}</Text>
          </View>
        ))
      )}
    </View>
  );

  const renderAgenda = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardTitle}>Agenda</Text>
          <Text style={styles.cardSubtitle}>Solicitacoes pendentes que precisam de atribuicao da secretaria.</Text>
        </View>
        <TouchableOpacity style={styles.inlineButton} onPress={() => navigation.navigate('Agendamentos')}>
          <Ionicons name="calendar-outline" size={16} color="#6D28D9" />
          <Text style={styles.inlineButtonText}>Abrir</Text>
        </TouchableOpacity>
      </View>

      <FilasList
        titulo="Agendamentos Pendentes"
        tipo="agendamento"
        dados={agendamentosOrdenados}
        loading={filas.loading}
        onAtribuir={handleAtribuirAgendamento}
        onRejeitar={handleRejeitarAgendamento}
        emptyMessage="Nenhum agendamento pendente no momento"
      />
    </View>
  );

  const renderHistorico = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Histórico</Text>
      <Text style={styles.cardSubtitle}>Últimas entradas da operação da secretaria.</Text>
      {historico.length === 0 ? (
        <Text style={styles.emptyText}>Ainda não há histórico para mostrar.</Text>
      ) : (
        historico.map((item) => (
          <View key={item.id} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineContent}>
              <View style={styles.listItemTop}>
                <View style={styles.patientBlock}>
                  <Text style={styles.patientLabel}>Paciente</Text>
                  <Text style={styles.listItemTitle}>{item.titulo}</Text>
                </View>
                {renderBadge(item.tipo)}
              </View>
              <Text style={styles.listItemDesc}>{item.descricao}</Text>
              <Text style={styles.listItemMeta}>{formatRelativeTime(item.created_at || new Date().toISOString())}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={filas.loading || financeiroLoading} onRefresh={carregarPainel} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shell}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="briefcase-outline" size={24} color={COLORS.textInverse} />
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={() => void carregarPainel()}>
              <Ionicons name="refresh-outline" size={16} color="#6D28D9" />
              <Text style={styles.refreshButtonText}>Atualizar</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{activeTab === 'financeiro' ? 'Tratamentos e Facturas' : 'Painel da Secretária'}</Text>
          <Text style={styles.heroSubtitle}>
            {activeTab === 'financeiro'
              ? 'Acompanhe os procedimentos enviados pelos dentistas, facturas emitidas e pagamentos.'
              : `${profile?.nome ? `${profile.nome}, acompanhe` : 'Acompanhe'} a operação do dia com foco em solicitações, agenda, alertas e retornos.`}
          </Text>
        </View>

        <View style={styles.topTabsRow}>
          <TouchableOpacity style={[styles.topTab, activeTab === 'operacoes' && styles.topTabActive]} onPress={() => setActiveTab('operacoes')}>
            <Ionicons name="grid-outline" size={16} color={activeTab === 'operacoes' ? COLORS.textInverse : COLORS.textSecondary} />
            <Text style={[styles.topTabText, activeTab === 'operacoes' && styles.topTabTextActive]}>Operacao</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.topTab, activeTab === 'financeiro' && styles.topTabActive]} onPress={() => setActiveTab('financeiro')}>
            <Ionicons name="receipt-outline" size={16} color={activeTab === 'financeiro' ? COLORS.textInverse : COLORS.textSecondary} />
            <Text style={[styles.topTabText, activeTab === 'financeiro' && styles.topTabTextActive]}>Tratamentos e Facturas</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'financeiro' ? (
          <TratamentosFacturasPanel items={tratamentosFinanceiros} loading={financeiroLoading} onRefresh={carregarFinanceiro} />
        ) : (
          <>
        <View style={styles.metricsRow}>
          {metricas.map((item) => (
            <View key={item.label} style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.board}>
          <View style={styles.columnLeft}>
            {renderMiniList(
              'Novas solicitações',
              'Pedidos mais recentes que chegaram para a secretaria.',
              novasSolicitacoes,
              'Nenhuma nova solicitação no momento.'
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Triagens</Text>
              <Text style={styles.cardSubtitle}>Casos que precisam de validação e encaminhamento.</Text>
              <FilasList
                titulo="Triagens Pendentes"
                tipo="triagem"
                dados={triagensOrdenadas}
                loading={filas.loading}
                onAtribuir={handleAtribuirTriagem}
                onRejeitar={handleRejeitarTriagem}
                emptyMessage="Nenhuma triagem pendente no momento"
              />
            </View>
          </View>

          <View style={styles.columnCenter}>
            {renderAgenda()}
          </View>

          <View style={styles.columnRight}>
            {renderMiniList(
              'Alertas',
              'Itens urgentes ou de alta prioridade.',
              alertas,
              'Nenhum alerta crítico agora.'
            )}
            {renderMiniList(
              'Retornos',
              'Itens que já aguardam atenção há mais tempo.',
              retornos,
              'Nenhum retorno pendente agora.'
            )}
          </View>
        </View>

        <View style={styles.footerSection}>
          {renderHistorico()}
        </View>
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  shell: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1180 : 760,
    alignSelf: 'center',
  },
  hero: {
    backgroundColor: '#6D28D9',
    borderRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  refreshButtonText: {
    color: '#6D28D9',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  heroTitle: {
    fontSize: 30,
    color: COLORS.textInverse,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  heroSubtitle: {
    marginTop: SPACING.sm,
    color: 'rgba(255,255,255,0.88)',
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    lineHeight: 21,
    maxWidth: 760,
  },
  topTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  topTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  topTabActive: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  topTabText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  topTabTextActive: {
    color: COLORS.textInverse,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: Platform.OS === 'web' ? 180 : 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#ECECEC',
    ...SHADOWS.sm,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  metricLabel: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
  },
  board: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  columnLeft: {
    flex: Platform.OS === 'web' ? 1.25 : undefined,
    width: '100%',
    gap: SPACING.md,
  },
  columnCenter: {
    flex: Platform.OS === 'web' ? 0.95 : undefined,
    width: '100%',
    gap: SPACING.md,
  },
  columnRight: {
    flex: Platform.OS === 'web' ? 0.8 : undefined,
    width: '100%',
    gap: SPACING.md,
  },
  footerSection: {
    marginTop: SPACING.md,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#ECECEC',
    ...SHADOWS.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  cardSubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F0FF',
  },
  inlineButtonText: {
    color: '#6D28D9',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  listItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  listItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  patientBlock: {
    flex: 1,
  },
  patientLabel: {
    color: '#6D28D9',
    fontSize: TYPOGRAPHY.sizes.xsmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  listItemTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  listItemDesc: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    lineHeight: 18,
    marginTop: 4,
  },
  listItemMeta: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.xsmall,
    marginTop: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeTriagem: {
    backgroundColor: '#E6FFFB',
  },
  badgeAgenda: {
    backgroundColor: '#EFF6FF',
  },
  badgeText: {
    fontSize: TYPOGRAPHY.sizes.xsmall,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  badgeTextTriagem: {
    color: '#0F766E',
  },
  badgeTextAgenda: {
    color: '#2563EB',
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  agendaTime: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaBody: {
    flex: 1,
  },
  agendaTitle: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  agendaDesc: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    lineHeight: 18,
    marginTop: 4,
  },
  agendaMeta: {
    color: '#2563EB',
    fontSize: TYPOGRAPHY.sizes.xsmall,
    marginTop: 6,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#6D28D9',
    marginTop: 6,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    lineHeight: 18,
    paddingVertical: 6,
  },
});

export default SecretaryDashboardScreen;
