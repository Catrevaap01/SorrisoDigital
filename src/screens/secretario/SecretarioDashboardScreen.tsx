import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import AssignmentModal from '../../components/AssignmentModal';
import {
  buscarTratamentosFinanceirosSecretaria,
  recusarTriagem,
  rejeitarAgendamento,
  TratamentoFinanceiroItem,
} from '../../services/secretarioService';
import { 
  gerarRelatorioGeral, 
  RelatorioGeral, 
  buildDentistBillingHtml,
  buildGeneralBillingHtml
} from '../../services/relatorioService';
import { atribuirTriagemADentista } from '../../services/triagemService';
import { atribuirAgendamentoAoDentista } from '../../services/secretarioService';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { formatRelativeTime } from '../../utils/helpers';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';
import { supabase } from '../../config/supabase';

type Props = BottomTabScreenProps<SecretarioTabParamList, 'SecretarioDashboard'>;

type ItemPainel = {
  id: string;
  tipo: 'triagem' | 'agendamento' | 'procedimento';
  titulo: string;
  descricao: string;
  created_at?: string;
  prioridade: string;
  raw: any;
};

type PainelTab = 'operacoes' | 'acompanhamento' | 'financeiro';

const formatCurrency = (value: number | string | undefined) => {
  const amount = Number(value || 0);
  if (isNaN(amount)) return '0 Kz';
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

const SecretarioDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useAuth();
  const { filas, carregarFilas } = useFilasSecretaria();
  const [activeTab, setActiveTab] = useState<PainelTab>('operacoes');
  const [tratamentosFinanceiros, setTratamentosFinanceiros] = useState<TratamentoFinanceiroItem[]>([]);
  const [financeiroLoading, setFinanceiroLoading] = useState(false);
  const [relatorioGeral, setRelatorioGeral] = useState<RelatorioGeral | null>(null);
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  
  // Modal de Atribuição
  const [modalAtribuicao, setModalAtribuicao] = useState({
    visible: false,
    item: null as any,
    tipo: 'triagem' as 'triagem' | 'agendamento',
  });

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

  const carregarRelatorio = useCallback(async () => {
    setRelatorioLoading(true);
    const result = await gerarRelatorioGeral();
    if (result.success) {
      setRelatorioGeral(result.data || null);
    } else {
      setRelatorioGeral(null);
      Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao carregar relatório geral' });
    }
    setRelatorioLoading(false);
  }, []);

  const carregarPainel = useCallback(async () => {
    await Promise.all([carregarFilas(), carregarFinanceiro(), carregarRelatorio()]);
  }, [carregarFilas, carregarFinanceiro, carregarRelatorio]);

  useFocusEffect(
    useCallback(() => {
      void carregarPainel();
    }, [carregarPainel])
  );

  // REALTIME: auto-refresh when appointments, triagens or procedures change
  useEffect(() => {
    const channel = supabase
      .channel('secretaria-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => { void carregarPainel(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'triagens' }, () => { void carregarPainel(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'procedimentos_tratamento' }, () => { void carregarPainel(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImprimirFaturacaoGeral = useCallback(async () => {
    if (!relatorioGeral) {
      Toast.show({ type: 'info', text1: 'Carregando dados', text2: 'Aguarde o carregamento do relatório geral.' });
      return;
    }
    const html = buildGeneralBillingHtml(relatorioGeral, profile?.nome);
    const result = await exportHtmlAsPdf(html, `faturacao-geral-${new Date().toISOString().split('T')[0]}.pdf`);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao imprimir', text2: result.error || 'Tente novamente' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Faturação geral pronta para impressão' });
  }, [relatorioGeral]);

  const handleImprimirDentista = useCallback(
    async (dentista: any) => {
      const itemsDentista = tratamentosFinanceiros.filter((item) => item.dentista_id === dentista.dentista.id);
      if (itemsDentista.length === 0) {
        Toast.show({ type: 'info', text1: 'Sem procedimentos', text2: `${dentista.dentista.nome} não tem procedimentos registrados.` });
        return;
      }
      const html = buildDentistBillingHtml(dentista.dentista.nome, itemsDentista, profile?.nome);
      const result = await exportHtmlAsPdf(html, `faturacao-${dentista.dentista.nome}-${new Date().toISOString().split('T')[0]}.pdf`);
      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Erro ao imprimir', text2: result.error || 'Tente novamente' });
        return;
      }
      Toast.show({ type: 'success', text1: `Faturação de ${dentista.dentista.nome} pronta para impressão` });
    },
    [tratamentosFinanceiros]
  );

  const handleAtribuirTriagem = useCallback(
    (item: any) => {
      setModalAtribuicao({
        visible: true,
        item,
        tipo: 'triagem',
      });
    },
    []
  );

  const handleAtribuirAgendamento = useCallback(
    (item: any) => {
      setModalAtribuicao({
        visible: true,
        item,
        tipo: 'agendamento',
      });
    },
    []
  );

  const handleConfirmarAtribuicao = async (dentistaId: string, observacao?: string) => {
    const { item, tipo } = modalAtribuicao;
    if (!item || !profile?.id) return;

    try {
      let result;
      if (tipo === 'triagem') {
        result = await atribuirTriagemADentista(item.id, dentistaId, profile.id);
      } else {
        result = await atribuirAgendamentoAoDentista(item.id, dentistaId, profile.id, undefined, undefined, observacao);
      }

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Atribuído com sucesso!',
          text2: 'O dentista já pode ver este paciente.',
        });
        setModalAtribuicao({ visible: false, item: null, tipo: 'triagem' });
        await carregarFilas();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao atribuir',
          text2: result.error || 'Tente novamente',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro crítico',
        text2: error.message || 'Falha na conexão',
      });
    }
  };

  const handleRejeitarTriagem = useCallback(
    (item: any) => {
      const title = 'Rejeitar triagem';
      const message = 'Deseja realmente rejeitar esta triagem?';

      if (Platform.OS === 'web') {
        const motivo = window.prompt(`${title}\n\nInforme o motivo da rejeição:`);
        if (motivo === null) return; // Cancelado
        const reason = motivo.trim() || 'Sem motivo especificado';
        
        void (async () => {
          if (!profile?.id) return;
          const result = await recusarTriagem(item.id, profile.id, reason);
          if (result.success) {
            Toast.show({ type: 'success', text1: 'Triagem rejeitada' });
            await carregarFilas();
          } else {
            Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
          }
        })();
      } else {
        Alert.alert(
          title,
          message,
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Confirmar Rejeição', 
              onPress: async () => {
                if (!profile?.id) return;
                const result = await recusarTriagem(item.id, profile.id, 'Rejeitado pela secretaria');
                if (result.success) {
                  Toast.show({ type: 'success', text1: 'Triagem rejeitada' });
                  await carregarFilas();
                } else {
                  Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
                }
              }
            }
          ]
        );
      }
    },
    [carregarFilas, profile?.id]
  );

  const handleRejeitarAgendamento = useCallback(
    (item: any) => {
      const title = 'Rejeitar agendamento';
      const message = 'Deseja realmente rejeitar este agendamento?';

      if (Platform.OS === 'web') {
        const motivo = window.prompt(`${title}\n\nInforme o motivo da rejeição:`);
        if (motivo === null) return; // Cancelado
        const reason = motivo.trim() || 'Sem motivo especificado';
        
        void (async () => {
          if (!profile?.id) return;
          const result = await rejeitarAgendamento(item.id, profile.id, reason);
          if (result.success) {
            Toast.show({ type: 'success', text1: 'Agendamento rejeitado' });
            await carregarFilas();
          } else {
            Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
          }
        })();
      } else {
        Alert.alert(
          title,
          message,
          [
            { text: 'Cancelar', style: 'cancel' },
            { 
              text: 'Confirmar Rejeição', 
              onPress: async () => {
                if (!profile?.id) return;
                const result = await rejeitarAgendamento(item.id, profile.id, 'Rejeitado pela secretaria');
                if (result.success) {
                  Toast.show({ type: 'success', text1: 'Agendamento rejeitado' });
                  await carregarFilas();
                } else {
                  Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao rejeitar' });
                }
              }
            }
          ]
        );
      }
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

  const itensCombinados = useMemo<ItemPainel[]>(() => {
    const triagens = triagensOrdenadas.map((item: any): ItemPainel => ({
      id: `triagem-${item.id}`,
      tipo: 'triagem',
      titulo: item.paciente?.nome || 'Paciente sem nome',
      descricao: item.sintoma_principal || 'Triagem recebida',
      created_at: item.created_at,
      prioridade: String(item.prioridade || item.intensidade_dor || 'normal'),
      raw: item,
    }));

    const agendamentos = agendamentosOrdenados.map((item: any): ItemPainel => {
      const tipo: ItemPainel['tipo'] = item.is_procedimento ? 'procedimento' : 'agendamento';
      let desc = item.symptoms || item.notes || 'Solicitação de consulta';
      
      // Se tiver data agendada, incluir na descrição para o dashboard
      if (item.appointment_date) {
        const dataStr = formatDate(item.appointment_date);
        const horaStr = item.appointment_time ? item.appointment_time.substring(0, 5) : '';
        desc = `${dataStr}${horaStr ? ' as ' + horaStr : ''} - ${desc}`;
      } else if (item.suggested_date) {
        desc = `${formatDateTime(item.suggested_date)} - ${desc}`;
      }

      return {
        id: `${tipo}-${item.id}`,
        tipo,
        titulo: item.paciente?.nome || 'Paciente sem nome',
        descricao: desc,
        created_at: item.created_at,
        prioridade: String(item.urgency || 'normal'),
        raw: item,
      };
    });

    return [...triagens, ...agendamentos].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [agendamentosOrdenados, triagensOrdenadas]);

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

  // Lógica para a aba Acompanhamento (A/B)
  const itensNaoAtribuidos = useMemo(() => 
    itensCombinados.filter(item => {
      const s = (item.raw.status || '').toLowerCase();
      // Não atribuídos são aqueles que aguardam análise inicial da secretaria
      return s === 'triagem_pendente_secretaria' || s === 'agendamento_pendente_secretaria' || s === 'solicitado';
    }),
    [itensCombinados]
  );

  const itensAtribuidos = useMemo(() => 
    itensCombinados.filter(item => {
      const s = (item.raw.status || '').toLowerCase();
      // Se não está no status inicial e tem um dentista vinculado, está atribuído
      return s !== 'triagem_pendente_secretaria' && s !== 'agendamento_pendente_secretaria' && s !== 'solicitado' && (item.raw.dentista_id || item.raw.dentista?.id);
    }),
    [itensCombinados]
  );

  const agrupadoPorDentista = useMemo(() => {
    return itensAtribuidos.reduce((acc, item) => {
      const dName = item.raw.dentista?.nome || 'Dentista';
      const dSpecialty = item.raw.dentista?.especialidade || '';
      const key = `${dName}|${dSpecialty}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, ItemPainel[]>);
  }, [itensAtribuidos]);

  const totalArrecadado = useMemo(
    () => relatorioGeral?.totalRecebido || 0,
    [relatorioGeral]
  );

  const totalAguardando = useMemo(
    () => relatorioGeral?.totalPendente || 0,
    [relatorioGeral]
  );

  const totalFaturadoGeral = useMemo(
    () => relatorioGeral?.totalFaturado || 0,
    [relatorioGeral]
  );

  const metricas = useMemo(
    () => [
      {
        label: 'Aguardando Factura',
        value: relatorioGeral?.aguardandoFatura || 0,
        icon: 'document-text-outline',
        color: '#DC2626',
      },
      {
        label: 'Receita Hoje',
        value: formatCurrency(relatorioGeral?.receitaHoje || 0),
        icon: 'cash-outline',
        color: '#059669',
      },
      {
        label: 'Receita Semana',
        value: formatCurrency(relatorioGeral?.receitaSemana || 0),
        icon: 'cash-outline',
        color: '#059669',
      },
      {
        label: 'Pacientes Hoje',
        value: relatorioGeral?.pacientesHoje || 0,
        icon: 'people-outline',
        color: '#7C3AED',
      },
      {
        label: 'Taxa Falta',
        value: `${relatorioGeral?.taxaFaltas || 0}%`,
        icon: 'alert-circle-outline',
        color: '#DC2626',
      },
    ],
    [relatorioGeral]
  );

  const relatorioMetrics = useMemo(() => {
    if (!relatorioGeral) return [];
    return [
      {
        label: 'Total Faturado',
        value: formatCurrency(relatorioGeral.totalFaturado),
        icon: 'receipt-outline',
        color: '#059669',
      },
      {
        label: 'Total Recebido',
        value: formatCurrency(relatorioGeral.totalRecebido),
        icon: 'cash-outline',
        color: '#059669',
      },
      {
        label: 'Aguardando',
        value: formatCurrency(relatorioGeral.totalPendente),
        icon: 'time-outline',
        color: '#DC2626',
      },
      {
        label: 'Procedimentos',
        value: String(relatorioGeral.totalProcedimentos || 0),
        icon: 'medical-outline',
        color: '#8B5CF6',
      },
    ];
  }, [relatorioGeral]);

  const renderBadge = (tipo: 'triagem' | 'agendamento' | 'procedimento') => (
    <View style={[
      styles.badge, 
      tipo === 'triagem' ? styles.badgeTriagem : (tipo === 'procedimento' ? styles.badgeProcedimento : styles.badgeAgenda)
    ]}>
      <Text style={[
        styles.badgeText, 
        tipo === 'triagem' ? styles.badgeTextTriagem : (tipo === 'procedimento' ? styles.badgeTextProcedimento : styles.badgeTextAgenda)
      ]}>
        {tipo === 'triagem' ? 'Triagem' : (tipo === 'procedimento' ? 'Tratamento' : 'Agenda')}
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

  const renderAcompanhamentoTab = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Atribuição de Pacientes</Text>
        <Text style={styles.sectionHeaderSubtitle}>Gerencie o encaminhamento de pacientes aos profissionais.</Text>
      </View>

      <View style={[styles.board, Platform.OS === 'web' && { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {/* SECÇÃO A: NÃO ATRIBUÍDOS */}
        <View style={[styles.card, { borderColor: '#7C3AED', borderTopWidth: 4, flex: 1, minWidth: Platform.OS === 'web' ? 400 : '100%' }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: '#7C3AED' }]}>NÃO ATRIBUÍDOS</Text>
              <Text style={styles.cardSubtitle}>Pacientes aguardando direcionamento para um dentista.</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#F3F0FF' }]}>
              <Text style={[styles.badgeText, { color: '#7C3AED' }]}>{itensNaoAtribuidos.length}</Text>
            </View>
          </View>

          {itensNaoAtribuidos.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma solicitação pendente no momento.</Text>
          ) : (
            itensNaoAtribuidos.map((item) => (
              <View key={item.id} style={styles.listItem}>
                <View style={styles.listItemTop}>
                  <View style={styles.patientBlock}>
                    <Text style={styles.patientLabel}>PACIENTE</Text>
                    <Text style={styles.listItemTitle}>{item.titulo}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.atribuirPrincipalBtn}
                    onPress={() => item.tipo === 'triagem' ? handleAtribuirTriagem(item.raw) : handleAtribuirAgendamento(item.raw)}
                  >
                    <Ionicons name="person-add-outline" size={14} color="white" />
                    <Text style={styles.atribuirPrincipalBtnText}>Atribuir Dentista</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.listItemDesc} numberOfLines={2}>{item.descricao}</Text>
                <View style={styles.listItemFooter}>
                  <Text style={styles.listItemMeta}>{formatRelativeTime(item.created_at || new Date().toISOString())}</Text>
                  {renderBadge(item.tipo)}
                </View>
              </View>
            ))
          )}
        </View>

        {/* SECÇÃO B: ATRIBUÍDOS */}
        <View style={[styles.card, { marginTop: Platform.OS === 'web' ? 0 : SPACING.lg, marginLeft: Platform.OS === 'web' ? SPACING.md : 0, borderColor: '#059669', borderTopWidth: 4, flex: 1, minWidth: Platform.OS === 'web' ? 400 : '100%' }]}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: '#059669' }]}>ATRIBUÍDOS</Text>
              <Text style={styles.cardSubtitle}>Pacientes já encaminhados para os profissionais.</Text>
            </View>
          </View>

          {Object.keys(agrupadoPorDentista).length === 0 ? (
            <Text style={styles.emptyText}>Nenhum paciente atribuído no momento.</Text>
          ) : (
            Object.entries(agrupadoPorDentista).map(([key, items]) => {
              const [dNome, dEsp] = key.split('|');
              return (
                <View key={key} style={styles.dentistGroup}>
                  <View style={styles.dentistGroupHeader}>
                    <Ionicons name="person-circle-outline" size={24} color="#059669" />
                    <View>
                      <Text style={styles.dentistGroupName}>Dr(a). {dNome}</Text>
                      <Text style={styles.dentistGroupEsp}>{dEsp || 'Clínica Geral'}</Text>
                    </View>
                  </View>
                  <View style={styles.dentistGroupItems}>
                    {items.map((it) => (
                      <View key={it.id} style={styles.assignedPatientItem}>
                        <View style={styles.assignedPatientPoint} />
                        <Text style={styles.assignedPatientName}>{it.titulo}</Text>
                        <View style={styles.assignedBadge}>
                           {renderBadge(it.tipo)}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    </>
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

  const renderOperacaoTab = () => (
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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Fluxo da Secretaria</Text>
        <Text style={styles.sectionHeaderSubtitle}>Organize triagens e agendamentos em painéis separados para uma leitura rápida e clara.</Text>
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
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={filas.loading || financeiroLoading || relatorioLoading} onRefresh={carregarPainel} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shell}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{activeTab === 'financeiro' ? 'Tratamentos e Facturas' : 'Painel da Secretária'}</Text>
            <Text style={styles.description}>
              {activeTab === 'financeiro'
                ? 'Acompanhe os procedimentos enviados pelos dentistas, facturas emitidas e pagamentos.'
                : `${profile?.nome ? `${profile.nome}, acompanhe` : 'Acompanhe'} a operação do dia com foco em solicitações, agenda e alertas.`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.messageButtonHeader} 
              onPress={() => (navigation as any).navigate('Mensagens')}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#6D28D9" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.primaryActionButton} 
              onPress={() => (navigation as any).navigate('CadastrarPaciente')}
            >
              <Ionicons name="person-add-outline" size={16} color="white" />
              <Text style={styles.primaryActionButtonText}>Novo Paciente</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.refreshButtonHeader} onPress={() => void carregarPainel()}>
              <Ionicons name="refresh-outline" size={16} color="#6D28D9" />
              <Text style={styles.refreshButtonTextHeader}>Atualizar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.topTabsRow}>
          <TouchableOpacity style={[styles.topTab, activeTab === 'operacoes' && styles.topTabActive]} onPress={() => setActiveTab('operacoes')}>
            <Ionicons name="grid-outline" size={16} color={activeTab === 'operacoes' ? 'white' : COLORS.textSecondary} />
            <Text style={[styles.topTabText, activeTab === 'operacoes' && styles.topTabTextActive]}>Operação</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.topTab, activeTab === 'acompanhamento' && styles.topTabActive]} onPress={() => setActiveTab('acompanhamento')}>
            <Ionicons name="people-outline" size={16} color={activeTab === 'acompanhamento' ? 'white' : COLORS.textSecondary} />
            <Text style={[styles.topTabText, activeTab === 'acompanhamento' && styles.topTabTextActive]}>Atribuição</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.topTab, activeTab === 'financeiro' && styles.topTabActive]} onPress={() => setActiveTab('financeiro')}>
            <Ionicons name="cash-outline" size={16} color={activeTab === 'financeiro' ? 'white' : COLORS.textSecondary} />
            <Text style={[styles.topTabText, activeTab === 'financeiro' && styles.topTabTextActive]}>Financeiro</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'operacoes' ? renderOperacaoTab() : 
         activeTab === 'acompanhamento' ? renderAcompanhamentoTab() : (
          <>
            <View style={styles.sectionHeader}> 
              <Text style={styles.sectionHeaderTitle}>Relatório financeiro</Text>
              <Text style={styles.sectionHeaderSubtitle}>Resumo de faturamento, arrecadação e performance de cada dentista.</Text>
            </View>
            <View style={styles.metricsRow}>
              {relatorioMetrics.map((item) => (
                <View key={item.label} style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: `${item.color}18` }]}> 
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={styles.metricValue}>{item.value}</Text>
                  <Text style={styles.metricLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Relatório geral</Text>
                  <Text style={styles.cardSubtitle}>Visão consolidada de dentistas, pacientes, triagens e receita.</Text>
                </View>
              </View>
              {relatorioLoading ? (
                <Text style={styles.emptyText}>Carregando relatório...</Text>
              ) : relatorioGeral ? (
                <View style={styles.reportSummary}>
                  <View style={styles.reportCell}>
                    <Text style={styles.reportLabel}>Dentistas</Text>
                    <Text style={styles.reportValue}>{relatorioGeral.totalDentistas}</Text>
                  </View>
                  <View style={styles.reportCell}>
                    <Text style={styles.reportLabel}>Pacientes</Text>
                    <Text style={styles.reportValue}>{relatorioGeral.totalPacientes}</Text>
                  </View>
                  <View style={styles.reportCell}>
                    <Text style={styles.reportLabel}>Triagens</Text>
                    <Text style={styles.reportValue}>{relatorioGeral.totalTriagens}</Text>
                  </View>
                  <View style={styles.reportCell}>
                    <Text style={styles.reportLabel}>Taxa de resposta</Text>
                    <Text style={styles.reportValue}>{relatorioGeral.percentualResposta}%</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyText}>Não foi possível carregar o relatório geral.</Text>
              )}
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Resumo por dentista</Text>
                  <Text style={styles.cardSubtitle}>Acompanhe o desempenho de cada dentista em triagens respondidas e pendentes.</Text>
                </View>
              </View>
              {relatorioLoading ? (
                <Text style={styles.emptyText}>Carregando dados dos dentistas...</Text>
              ) : relatorioGeral?.dentistas?.length ? (
                relatorioGeral.dentistas.slice(0, 10).map((item) => {
                  if (!item || !item.dentista) return null;
                  return (
                    <View key={item.dentista.id} style={styles.dentistRowContainer}>
                      <View style={styles.dentistRow}>
                        <View style={styles.dentistInfo}>
                          <Text style={styles.dentistName}>{item.dentista.nome}</Text>
                          <Text style={styles.dentistMeta}>{item.dentista.especialidade || 'Clínica Geral'}</Text>
                        </View>
                        <View style={styles.dentistStats}>
                          <View style={styles.faturacaoPill}>
                             <Text style={styles.faturacaoPillLabel}>Faturado: </Text>
                             <Text style={styles.faturacaoPillValue}>{formatCurrency(item.totalFaturado)}</Text>
                          </View>
                          <Text style={styles.dentistStat}>{item.totalTriagens} triagens | {item.totalProcedimentos} procedimentos</Text>
                        </View>
                      </View>
                      <View style={styles.dentistActions}>
                        <View style={styles.billingSubStats}>
                           <Text style={[styles.billingSubStat, { color: '#059669', fontWeight: 'bold' }]}>
                             Pago: {formatCurrency(item.totalRecebido)}
                           </Text>
                           <Text style={[styles.billingSubStat, { color: (item.pendenteReceber || 0) > 0 ? '#B91C1C' : '#64748b' }]}>
                             Pendente: {formatCurrency(item.pendenteReceber)}
                           </Text>
                        </View>
                        <TouchableOpacity style={styles.printDentistBtn} onPress={() => void handleImprimirDentista(item)}>
                          <Ionicons name="print-outline" size={14} color="#047857" />
                          <Text style={styles.printDentistBtnText}>Imprimir faturação</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Nenhum relatório de dentista disponível.</Text>
              )}
            </View>
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>Faturação geral</Text>
                  <Text style={styles.cardSubtitle}>Relatório consolidado de toda faturação, recebimentos e pendências.</Text>
                </View>
              </View>
                            <View style={styles.billingMetricsRow}>
                <View style={styles.billingMetricItem}>
                  <Text style={styles.billingMetricLabel}>Procedimentos</Text>
                  <Text style={styles.billingMetricValue}>{relatorioGeral?.totalProcedimentos || 0}</Text>
                </View>
                <View style={styles.billingMetricItem}>
                  <Text style={styles.billingMetricLabel}>Total Faturado</Text>
                  <Text style={styles.billingMetricValue}>{formatCurrency(totalFaturadoGeral)}</Text>
                </View>
                <View style={styles.billingMetricItem}>
                  <Text style={styles.billingMetricLabel}>Total Recebido</Text>
                  <Text style={[styles.billingMetricValue, { color: '#059669' }]}>{formatCurrency(totalArrecadado)}</Text>
                </View>
                <View style={styles.billingMetricItem}>
                  <Text style={styles.billingMetricLabel}>Total Pendente</Text>
                  <Text style={[styles.billingMetricValue, { color: (totalAguardando || 0) > 0 ? '#B91C1C' : '#1e293b' }]}>{formatCurrency(totalAguardando)}</Text>
                </View>
              </View>
            </View>
            
            <View style={{ marginBottom: SPACING.md }}>
              <TouchableOpacity style={styles.printGeneralBtn} onPress={() => void handleImprimirFaturacaoGeral()}>
                <Ionicons name="print-outline" size={16} color="white" />
                <Text style={styles.printGeneralBtnText}>Imprimir Relatório</Text>
              </TouchableOpacity>
            </View>

            <TratamentosFacturasPanel items={tratamentosFinanceiros} loading={financeiroLoading} onRefresh={carregarFinanceiro} />
          </>
        )}
        <AssignmentModal
          visible={modalAtribuicao.visible}
          onClose={() => setModalAtribuicao({ ...modalAtribuicao, visible: false })}
          onConfirm={handleConfirmarAtribuicao}
          pacienteNome={modalAtribuicao.item?.paciente?.nome || 'Paciente'}
          especialidadeSugerida={
            modalAtribuicao.tipo === 'triagem' 
              ? modalAtribuicao.item?.sintoma_principal 
              : modalAtribuicao.item?.symptoms
          }
        />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: '800',
  },
  description: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    ...SHADOWS.sm,
  },
  primaryActionButtonText: {
    color: 'white',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '700',
  },
  messageButtonHeader: {
    backgroundColor: '#F3F0FF',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  refreshButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F0FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  refreshButtonTextHeader: {
    color: '#6D28D9',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '700',
  },
  topTabsRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 4,
    marginBottom: SPACING.md,
    gap: 4,
  },
  topTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  topTabActive: {
    backgroundColor: '#7C3AED',
  },
  topTabText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  topTabTextActive: {
    color: 'white',
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
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
  reportSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  reportCell: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 180 : '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: SPACING.sm,
  },
  reportLabel: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.xsmall,
    marginBottom: 6,
  },
  reportValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  board: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'flex-start',
  },
  columnLeft: {
    flex: Platform.OS === 'web' ? 1.1 : undefined,
    maxWidth: Platform.OS === 'web' ? 360 : '100%',
    width: '100%',
    gap: SPACING.md,
  },
  columnCenter: {
    flex: 1,
    maxWidth: Platform.OS === 'web' ? 460 : '100%',
    width: '100%',
    gap: SPACING.md,
  },
  columnRight: {
    flex: Platform.OS === 'web' ? 0.95 : undefined,
    maxWidth: Platform.OS === 'web' ? 320 : '100%',
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
  badgeProcedimento: {
    backgroundColor: '#FFF7ED',
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
  badgeTextProcedimento: {
    color: '#C2410C',
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
  dentistRowContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dentistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  faturacaoPill: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  faturacaoPillLabel: {
    fontSize: 10,
    color: '#0D9488',
    fontWeight: '600',
  },
  faturacaoPillValue: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: 'bold',
  },
  dentistActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  billingSubStats: {
    flex: 1,
  },
  billingSubStat: {
    fontSize: 11,
    color: '#64748b',
  },
  dentistInfo: {
    flex: 1,
  },
  dentistName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  dentistMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dentistStats: {
    alignItems: 'flex-end',
  },
  dentistStat: {
    fontSize: 11,
    color: '#64748b',
  },
  printDentistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  printDentistBtnText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginLeft: 6,
  },
  printGeneralBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  printGeneralBtnText: {
    color: 'white',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  billingMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  billingMetricItem: {
    flex: 1,
    minWidth: Platform.OS === 'web' ? 120 : '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billingMetricLabel: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.xsmall,
    marginBottom: 4,
  },
  billingMetricValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  listItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  atribuirPrincipalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  atribuirPrincipalBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  dentistGroup: {
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 16,
  },
  dentistGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dentistGroupName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  dentistGroupEsp: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dentistGroupItems: {
    paddingLeft: 34,
    gap: 10,
  },
  assignedPatientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assignedPatientPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  assignedPatientName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  assignedBadge: {
    transform: [{ scale: 0.85 }],
  },
});

export default SecretarioDashboardScreen;
