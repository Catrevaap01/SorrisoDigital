import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SecretarioTabParamList } from '../../navigation/types';
import { Agendamento } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDateTime } from '../../utils/helpers';
import { supabase } from '../../config/supabase';

type Props = BottomTabScreenProps<SecretarioTabParamList, 'Agendamentos'>;
type TabKey = 'pendentes' | 'encaminhados' | 'retornos' | 'historico';

type AgendaItem = Agendamento & {
  urgency?: string;
  symptoms?: string;
  paciente?: { nome?: string; telefone?: string; email?: string } | null;
  dentista?: { nome?: string; especialidade?: string } | null;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'encaminhados', label: 'Encaminhados' },
  { key: 'retornos', label: 'Retornos' },
  { key: 'historico', label: 'Historico' },
];

const getAppointmentType = (item: AgendaItem): string =>
  item.tipo || item.dentista?.especialidade || 'Clinica Geral';

const getStatusLabel = (status?: string): string => {
  const value = String(status || '').toLowerCase();
  if (value === 'agendamento_pendente_secretaria') return 'Pendente';
  if (value === 'atribuido_dentista' || value === 'pendente') return 'Aguardando dentista';
  if (value === 'agendado' || value === 'confirmado') return 'Confirmado';
  if (value === 'cancelado' || value === 'rejeitado') return 'Cancelado';
  if (value === 'realizado') return 'Realizado';
  return status || 'Pendente';
};

const getStatusTone = (status?: string) => {
  const value = getStatusLabel(status).toLowerCase();
  if (value.includes('cancelado')) return { bg: '#FEE2E2', text: '#B91C1C' };
  if (value.includes('confirmado')) return { bg: '#DCFCE7', text: '#166534' };
  if (value.includes('aguardando')) return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#EDE9FE', text: '#6D28D9' };
};

const getUrgencyTone = (urgency?: string) => {
  const value = String(urgency || '').toLowerCase();
  if (value === 'urgente') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Urgente' };
  if (value === 'alta') return { bg: '#FFEDD5', text: '#C2410C', label: 'Alta' };
  if (value === 'baixa') return { bg: '#DCFCE7', text: '#166534', label: 'Baixa' };
  return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Normal' };
};

const SecretarioAgendamentosScreen: React.FC<Props> = ({ navigation }) => {
  const [agendamentos, setAgendamentos] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('pendentes');

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        *,
        paciente:profiles!paciente_id(id, nome, telefone, email),
        dentista:profiles!dentista_id(id, nome, especialidade)
      `)
      .order('created_at', { ascending: false })
      .limit(120);

    if (!error && data) {
      setAgendamentos(data as AgendaItem[]);
    } else {
      setAgendamentos([]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  }, [carregar]);

  const grouped = useMemo(() => {
    const pendentes = agendamentos.filter((item) =>
      [
        'agendamento_pendente_secretaria',
        'atribuido_dentista',
        'pendente',
        'agendado',
        'confirmado',
        'sugerido',
      ].includes(String(item.status || '').toLowerCase())
    );
    const encaminhados = agendamentos.filter((item) =>
      ['atribuido_dentista', 'pendente', 'agendado', 'confirmado', 'sugerido'].includes(String(item.status || '').toLowerCase())
    );
    const retornos = agendamentos.filter((item) =>
      ['agendado', 'confirmado', 'cancelado', 'rejeitado', 'sugerido'].includes(String(item.status || '').toLowerCase())
    );
    const historico = agendamentos.filter((item) =>
      ['realizado', 'confirmado', 'cancelado'].includes(String(item.status || '').toLowerCase())
    );
    return { pendentes, encaminhados, retornos, historico };
  }, [agendamentos]);

  const filteredItems = useMemo(() => {
    const base = grouped[tab];
    const term = search.trim().toLowerCase();

    return base.filter((item) => {
      if (!term) return true;
      const patientName = String(item.paciente?.nome || '').toLowerCase();
      const problem = String(item.symptoms || item.observacoes || '').toLowerCase();
      const doctor = String(item.dentista?.nome || '').toLowerCase();
      return patientName.includes(term) || problem.includes(term) || doctor.includes(term);
    });
  }, [grouped, search, tab]);

  const counters = useMemo(
    () => ({
      pendentes: grouped.pendentes.length,
      encaminhados: grouped.encaminhados.length,
      retornos: grouped.retornos.length,
      historico: grouped.historico.length,
    }),
    [grouped]
  );

  const handleAbrirAtribuicao = (item: AgendaItem) => {
    navigation.getParent()?.navigate(
      'AtribuirAgendamento',
      {
        agendamentoId: item.id,
        especialidadeSugerida: item.tipo || item.symptoms,
      } as any
    );
  };

  const renderItem = ({ item }: { item: AgendaItem }) => {
    const statusTone = getStatusTone(item.status);
    const urgencyTone = getUrgencyTone(item.urgency || item.prioridade);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.requestMain}>
            <Text style={styles.patientLabel}>Paciente</Text>
            <Text style={styles.requestName}>{item.paciente?.nome || 'Nao identificado'}</Text>
            <Text style={styles.requestProblem}>
              {item.symptoms || item.observacoes || 'Solicitacao sem descricao detalhada'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusTone.bg }]}>
            <Text style={[styles.statusText, { color: statusTone.text }]}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{getAppointmentType(item)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            {item.data_agendamento ? formatDateTime(item.data_agendamento) : 'Sem horario'}
          </Text>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyTone.bg }]}>
            <Text style={[styles.urgencyText, { color: urgencyTone.text }]}>{urgencyTone.label}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.contactText}>
            {item.paciente?.telefone || 'Sem telefone'}
            {item.dentista?.nome ? ` • Dr(a). ${item.dentista.nome}` : ''}
          </Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => handleAbrirAtribuicao(item)}>
            <Text style={styles.primaryActionText}>
              {tab === 'pendentes'
                ? (item.status === 'agendamento_pendente_secretaria' ? 'Agendar' : 'Abrir')
                : tab === 'encaminhados'
                  ? 'Ver encaminhamento'
                  : 'Abrir'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const emptyState = (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-clear-outline" size={40} color="#6D28D9" />
      <Text style={styles.emptyTitle}>Nenhum agendamento aqui</Text>
      <Text style={styles.emptyText}>Nao ha itens nesta aba no momento.</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6D28D9" />
        <Text style={styles.loadingTitle}>Carregando agendamentos</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredItems}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={styles.list}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Agendamentos</Text>
              <Text style={styles.description}>Veja todas as agendas pendentes e os encaminhamentos em aberto.</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={16} color="#6D28D9" />
              <Text style={styles.refreshButtonText}>Atualizar</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar paciente, problema ou dentista"
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={COLORS.textSecondary}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {TABS.map((item) => {
              const active = tab === item.key;
              const count = counters[item.key];
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setTab(item.key)}
                >
                  <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
                    {item.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={<View style={styles.list}>{emptyState}</View>}
      contentContainerStyle={styles.flatContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ItemSeparatorComponent={() => <View style={{ height: SIZES.md }} />}
    />
  );
};

const styles = StyleSheet.create({
  flatContent: {
    paddingBottom: 32,
  },
  list: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: SIZES.md,
    paddingTop: SIZES.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F8',
    paddingHorizontal: SIZES.lg,
  },
  loadingTitle: {
    marginTop: SIZES.md,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
    gap: SIZES.sm,
  },
  title: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: '800',
  },
  description: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: SIZES.fontMd,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SIZES.radiusFull,
  },
  refreshButtonText: {
    color: '#6D28D9',
    fontSize: SIZES.fontSm,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: SIZES.fontMd,
    ...SHADOWS.sm,
  },
  tabsRow: {
    gap: SIZES.sm,
    paddingTop: SIZES.md,
    paddingBottom: SIZES.sm,
  },
  tabButton: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabButtonActive: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  tabButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: COLORS.textInverse,
  },
  requestCard: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    marginHorizontal: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    ...SHADOWS.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SIZES.sm,
  },
  requestMain: {
    flex: 1,
  },
  patientLabel: {
    color: '#6D28D9',
    fontSize: SIZES.fontSm,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  requestName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  requestProblem: {
    color: COLORS.textSecondary,
    marginTop: 4,
    fontSize: SIZES.fontMd,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontWeight: '800',
    fontSize: SIZES.fontSm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: SIZES.md,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },
  metaDot: {
    color: '#CBD5E1',
    fontSize: SIZES.fontSm,
  },
  urgencyBadge: {
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  urgencyText: {
    fontSize: SIZES.fontSm,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: SIZES.md,
    paddingTop: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SIZES.sm,
    flexWrap: 'wrap',
  },
  contactText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.fontSm,
    flexShrink: 1,
  },
  primaryAction: {
    backgroundColor: '#6D28D9',
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.xxl,
    paddingHorizontal: SIZES.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SecretarioAgendamentosScreen;
