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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { SecretarioTabParamList } from '../../navigation/types';
import { Agendamento, enrichAgendamentosComValorPlano } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { supabase } from '../../config/supabase';

type Props = BottomTabScreenProps<SecretarioTabParamList, 'Agendamentos'>;
type TabKey = 'pendentes' | 'encaminhados' | 'retornos' | 'historico';

type AgendaItem = Agendamento & {
  urgency?: string;
  symptoms?: string;
  valor_estimado_plano?: number;
  paciente?: { nome?: string; telefone?: string; email?: string } | null;
  dentista?: { nome?: string; especialidade?: string } | null;
};

const PRECO_POR_TIPO: Record<string, number> = {
  consulta: 25000, avaliacao: 30000, retorno: 15000, urgencia: 45000,
  raio_x: 20000, panoramico: 35000, profilaxia: 22000, branqueamento: 60000,
  canal: 90000, ortodontia: 120000, restauracao: 40000,
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
  if (value === 'agendamento_pendente_secretaria' || value === 'solicitado') return 'Pendente';
  if (value === 'atribuido_dentista' || value === 'aguardando_dentista') return 'Aguardando dentista';
  if (value === 'reagendamento_solicitado' || value === 'confirmado_dentista') return 'Confirmado';
  if (value === 'cancelado' || value === 'rejeitado_dentista') return 'Cancelado';
  if (value === 'realizado') return 'Realizado';
  return status || 'Pendente';
};

const getStatusTone = (status?: string) => {
  const label = getStatusLabel(status).toLowerCase();
  
  if (label === 'pendente') return { bg: '#FEE2E2', text: '#DC2626' }; // Não atribuído em vermelho
  if (label.includes('cancelado')) return { bg: '#FEE2E2', text: '#B91C1C' };
  if (label.includes('confirmado')) return { bg: '#DCFCE7', text: '#166534' };
  if (label.includes('aguardando')) return { bg: '#FEF3C7', text: '#92400E' };
  return { bg: '#EDE9FE', text: '#6D28D9' };
};

const getUrgencyTone = (urgency?: string) => {
  const value = String(urgency || '').toLowerCase();
  if (value === 'urgente') return { bg: '#FEE2E2', text: '#B91C1C', label: 'Urgente' };
  if (value === 'alta') return { bg: '#FFEDD5', text: '#C2410C', label: 'Alta' };
  if (value === 'baixa') return { bg: '#DCFCE7', text: '#166534', label: 'Baixa' };
  return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Normal' };
};

const createStyles = (isMobile: boolean) => StyleSheet.create({
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
  container: {
    flex: 1,
    backgroundColor: '#F3F4F8',
  },
  content: {
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
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    marginBottom: SIZES.md,
    gap: SIZES.md,
  },
  title: {
    fontSize: isMobile ? 22 : 24,
    color: COLORS.text,
    fontWeight: '800',
  },
  description: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: SIZES.fontMd,
    width: '100%',
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
    fontSize: isMobile ? 18 : 22,
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

const SecretarioAgendamentosScreen: React.FC<Props> = ({ navigation }) => {
  const [agendamentos, setAgendamentos] = useState<AgendaItem[]>([]);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const styles = useMemo(() => createStyles(isMobile), [isMobile]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('pendentes');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Buscar agendamentos tradicionais
      const { data: agendaData, error: agendaError } = await supabase
        .from('appointments')
        .select(`
          *,
          paciente:profiles!patient_id(id, nome, telefone, email),
          dentista:profiles!dentist_id(id, nome, especialidade)
        `)
        .order('created_at', { ascending: false })
        .limit(150);

      // 2. Buscar procedimentos (tratamentos) pendentes que precisam de agenda
      const { data: procsData, error: procsError } = await supabase
        .from('procedimentos_tratamento')
        .select('*, plano:planos_tratamento(id, paciente_id, dentista_id)')
        .eq('status', 'pendente')
        .limit(50);

      let finalAgendas: AgendaItem[] = [];

      if (!agendaError && agendaData) {
        finalAgendas = agendaData as AgendaItem[];
      }

      if (!procsError && procsData && procsData.length > 0) {
        // Enriquecer procedimentos
        const patientIds = procsData.map((p: any) => p.plano?.paciente_id).filter(Boolean);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nome, telefone, email')
          .in('id', patientIds);
        
        const profilesById = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

        const mappedProcs = procsData.map((p: any) => ({
          id: p.id,
          patient_id: p.plano?.paciente_id,
          symptoms: `Tratamento: ${p.descricao}`,
          urgency: 'normal',
          status: 'procedimento_pendente',
          created_at: p.created_at,
          paciente: profilesById[p.plano?.paciente_id] || { nome: 'Paciente' },
          is_procedimento: true,
          plano_id: p.plano_id
        }));

        finalAgendas = [...finalAgendas, ...mappedProcs].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      }

      const enrichedFinal = await enrichAgendamentosComValorPlano(finalAgendas);
      setAgendamentos(enrichedFinal);
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
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
        'solicitado',
        'atribuido_dentista',
        'procedimento_pendente',
        'pendente',
        'aguardando_dentista',
        'sugerido',
      ].includes(String(item.status || '').toLowerCase())
    );
    const encaminhados = agendamentos.filter((item) =>
      ['atribuido_dentista', 'aguardando_dentista', 'confirmado_dentista', 'notificado_paciente'].includes(String(item.status || '').toLowerCase())
    );
    const retornos = agendamentos.filter((item) =>
      ['rejeitado_dentista', 'reagendamento_solicitado', 'cancelado'].includes(String(item.status || '').toLowerCase())
    );
    const historico = agendamentos.filter((item) =>
      ['realizado', 'cancelado'].includes(String(item.status || '').toLowerCase())
    );
    return { pendentes, encaminhados, retornos, historico };
  }, [agendamentos]);

  const filteredItems = useMemo(() => {
    const base = grouped[tab];
    const term = search.trim().toLowerCase();

    return base.filter((item) => {
      if (!term) return true;
      const patientName = String(item.paciente?.nome || '').toLowerCase();
      const problem = String(item.symptoms || item.notes || '').toLowerCase();
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
            <Text style={styles.requestName}>{item.paciente?.nome || 'Paciente'}</Text>
            <Text style={styles.requestProblem}>
              {item.symptoms || item.notes || 'Solicitação sem descrição detalhada'}
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
            {(() => {
              const dataBase = item.appointment_date || item.suggested_date;
              if (!dataBase) return 'Sem horário';
              
              let hora = '';
              
              // Se tiver appointment_time, usa ele (preferencial)
              if (item.appointment_time) {
                hora = item.appointment_time.substring(0, 5);
              } 
              // Se não tiver mas a data for ISO com T, extrai a hora
              else if (typeof dataBase === 'string' && dataBase.includes('T')) {
                const parts = dataBase.split('T');
                if (parts[1]) hora = parts[1].substring(0, 5);
              }
              
              // Se ainda assim for 00:00 ou vazia, e tiver suggested_date, tenta extrair de lá
              if ((!hora || hora === '00:00') && item.suggested_date && item.suggested_date.includes('T')) {
                const parts = item.suggested_date.split('T');
                if (parts[1]) hora = parts[1].substring(0, 5);
              }

              return `${formatDate(dataBase)}${hora && hora !== '00:00' ? ` as ${hora}` : ''}`;
            })()}
            {item.status === 'reagendamento_solicitado' && <Text style={{ color: '#F59E0B' }}> ⭐ Sugerido</Text>}
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
          {item.valor_estimado_plano && item.valor_estimado_plano > 0 ? (
            <Text style={styles.contactText}>Estimativa plano: {item.valor_estimado_plano.toLocaleString('pt-AO')} Kz</Text>
          ) : (
            <Text style={styles.contactText}>Estimativa: {(PRECO_POR_TIPO[item.tipo || 'consulta'] || 0).toLocaleString('pt-AO')} Kz</Text>
          )}
          <TouchableOpacity 
            style={[
              styles.primaryAction, 
              ['atribuido_dentista', 'pendente', 'confirmado', 'agendado'].includes(String(item.status || '').toLowerCase()) && { backgroundColor: '#94A3B8' }
            ]} 
            onPress={() => {
              if (['atribuido_dentista', 'pendente', 'confirmado', 'agendado'].includes(String(item.status || '').toLowerCase())) return;
              handleAbrirAtribuicao(item);
            }}
            disabled={['atribuido_dentista', 'pendente', 'confirmado', 'agendado'].includes(String(item.status || '').toLowerCase())}
          >
            <Text style={styles.primaryActionText}>
              {['atribuido_dentista', 'pendente', 'confirmado', 'agendado'].includes(String(item.status || '').toLowerCase())
                ? 'Atribuído'
                : (tab === 'pendentes' ? 'Agendar' : 'Abrir')}
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

export default SecretarioAgendamentosScreen;
