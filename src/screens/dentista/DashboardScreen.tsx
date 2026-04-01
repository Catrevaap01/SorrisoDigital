import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/AuthContext';
import { DentistaTabParamList } from '../../navigation/types';
import { Agendamento, ServiceResult, buscarAgendaDentista, buscarAgendamentosDentistaPorPeriodo } from '../../services/agendamentoService';
import { buscarContadoresDentista, buscarTriagensDentista, Contadores, Triagem } from '../../services/triagemService';
import { COLORS, SHADOWS, SIZES } from '../../styles/theme';
import { PRIORIDADE, STATUS_AGENDAMENTO, STATUS_TRIAGEM, TIPOS_CONSULTA } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';
import { getEspecialidadeConfig, EspecialidadeConfig } from '../../config/specialtyConfig';

type Props = BottomTabScreenProps<DentistaTabParamList, 'Dashboard'>;
type ListaItem = Triagem | Agendamento;

const CONTADORES_DEFAULT: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0, realizados: 0 };
const PRECO_POR_TIPO: Record<string, number> = { consulta: 25000, avaliacao: 30000, retorno: 15000, urgencia: 45000, raio_x: 20000, panoramico: 35000, profilaxia: 22000, branqueamento: 60000, canal: 90000, ortodontia: 120000, restauracao: 40000 };

const currency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 });

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendaHoje, setAgendaHoje] = useState<Agendamento[]>([]);
  const [contadores, setContadores] = useState<Contadores>(CONTADORES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'pendente' | 'urgente' | 'respondido' | 'realizados'>('todos');
  const hasLoadedRef = useRef(false);

  // Configuração por especialidade
  const specConfig: EspecialidadeConfig = useMemo(
    () => getEspecialidadeConfig(profile?.especialidade),
    [profile?.especialidade]
  );

  const carregarDados = useCallback(async () => {
    if (!profile?.id) return;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    const fimSemana = new Date();
    const inicioSemana = new Date();
    inicioSemana.setHours(0, 0, 0, 0);
    inicioSemana.setDate(inicioSemana.getDate() - 6);
    fimSemana.setDate(fimSemana.getDate() + 1);

    const [contResult, triResult, agResult, hojeResult] = await Promise.all([
      buscarContadoresDentista(profile.id).catch(e => ({ success: false, data: CONTADORES_DEFAULT, error: e.message })),
      buscarTriagensDentista(profile.id).catch(e => ({ success: false, data: [], error: e.message })),
      buscarAgendamentosDentistaPorPeriodo(profile.id, inicioSemana, fimSemana).catch(e => ({ success: false, data: [], error: e.message })),
      buscarAgendaDentista(profile.id, new Date()).catch(e => ({ success: false, data: [], error: e.message }))
    ]);

    setContadores(contResult.success ? contResult.data ?? CONTADORES_DEFAULT : CONTADORES_DEFAULT);
    setTriagens(triResult.success ? triResult.data ?? [] : []);
    setAgendamentos(agResult.success ? agResult.data ?? [] : []);
    setAgendaHoje(hojeResult.success ? hojeResult.data ?? [] : []);

    const errors = [contResult, triResult, agResult, hojeResult].filter(r => !r.success).length;
    if (errors > 0) {
      logger.warn(`Dashboard: ${errors}/4 services failed on ${Platform.OS}, showing partial data`);
    }

    hasLoadedRef.current = true;
    setLoading(false);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { void carregarDados(); }, [carregarDados]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - 6);
    const agendaSemana = agendamentos.filter((item) => new Date(item.data_agendamento) >= weekStart);
    const realizadosHoje = agendaHoje.filter((item) => item.status === 'realizado');
    const realizadosSemana = agendaSemana.filter((item) => item.status === 'realizado');
    const canceladosSemana = agendaSemana.filter((item) => item.status === 'cancelado');
    const proximos = [...agendaHoje]
      .filter((item) => ['agendado', 'confirmado'].includes(item.status || '') && new Date(item.data_agendamento) >= now)
      .sort((a, b) => new Date(a.data_agendamento).getTime() - new Date(b.data_agendamento).getTime())
      .slice(0, 3);
    const atrasados = agendaHoje.filter((item) => ['agendado', 'confirmado'].includes(item.status || '') && new Date(item.data_agendamento) < now);
    const receitaHoje = realizadosHoje.reduce((sum, item) => sum + (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0), 0);
    const receitaSemana = realizadosSemana.reduce((sum, item) => sum + (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0), 0);
    const procedimentosMap = realizadosSemana.reduce((acc, item) => {
      const tipo = item.tipo || 'consulta';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const procedimentos = Object.entries(procedimentosMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const taxaFaltas = canceladosSemana.length + realizadosSemana.length > 0
      ? (canceladosSemana.length / (canceladosSemana.length + realizadosSemana.length)) * 100
      : 0;

    return {
      proximos,
      atrasados,
      receitaHoje,
      receitaSemana,
      faltasSemana: canceladosSemana.length,
      atendidosHoje: new Set(realizadosHoje.map((item) => item.paciente_id).filter(Boolean)).size,
      atendidosSemana: new Set(realizadosSemana.map((item) => item.paciente_id).filter(Boolean)).size,
      procedimentos,
      taxaFaltas,
    };
  }, [agendaHoje, agendamentos]);

  const dadosFiltrados: ListaItem[] = useMemo(() => {
    if (filtroAtivo === 'todos') {
      const filteredAgendamentos = agendamentos.filter(a => {
        const s = (a.status || '').toLowerCase();
        return ['agendado', 'confirmado', 'realizado', 'pendente', 'urgente'].includes(s);
      });
      return [...triagens, ...filteredAgendamentos].sort((a, b) => {
        const aStatus = (a.status || '').toLowerCase();
        const bStatus = (b.status || '').toLowerCase();
        const aPrio = (a.prioridade || '').toLowerCase();
        const bPrio = (b.prioridade || '').toLowerCase();
        
        const aIsUrgente = aStatus === 'urgente' || aPrio === 'urgente' || aPrio === 'alta';
        const bIsUrgente = bStatus === 'urgente' || bPrio === 'urgente' || bPrio === 'alta';

        if (aIsUrgente && !bIsUrgente) return -1;
        if (!aIsUrgente && bIsUrgente) return 1;

        return new Date(b.created_at || (b as any).data_agendamento).getTime() - 
               new Date(a.created_at || (a as any).data_agendamento).getTime();
      });
    }

    if (filtroAtivo === 'respondido') {
      const tResp = triagens.filter(t => {
        const s = (t.status || '').toLowerCase();
        const as = ((t as any).agendamento_status || '').toLowerCase();
        const hasResp = (t.respostas && t.respostas.length > 0) || s === 'respondido';
        const isReal = s === 'realizado' || as === 'realizado';
        return hasResp && !isReal;
      });
      return tResp.sort((a, b) => new Date(b.created_at || (b as any).data_agendamento || 0).getTime() - new Date(a.created_at || (a as any).data_agendamento || 0).getTime());
    }

    if (filtroAtivo === 'urgente') {
      const tUrg = triagens.filter(t => {
        const s = (t.status || '').toLowerCase();
        const p = (t.prioridade || '').toLowerCase();
        const hasResp = (t.respostas && t.respostas.length > 0) || s === 'respondido';
        const isUrg = s === 'urgente' || p === 'urgente' || p === 'alta';
        return !hasResp && isUrg && s !== 'realizado';
      });
      const aUrg = agendamentos.filter(a => {
        const s = (a.status || '').toLowerCase();
        const as = ((a as any).agendamento_status || '').toLowerCase();
        const p = (a.prioridade || '').toLowerCase();
        const isUrg = s === 'urgente' || p === 'urgente' || p === 'alta';
        const isReal = s === 'realizado' || as === 'realizado';
        return isUrg && !isReal;
      });
      return [...tUrg, ...aUrg].sort((a, b) => new Date(b.created_at || (b as any).data_agendamento || 0).getTime() - new Date(a.created_at || (a as any).data_agendamento || 0).getTime());
    }

    if (filtroAtivo === 'pendente') {
      const tPend = triagens.filter(t => {
        const s = (t.status || '').toLowerCase();
        const p = (t.prioridade || '').toLowerCase();
        const hasResp = (t.respostas && t.respostas.length > 0) || s === 'respondido';
        const isUrg = s === 'urgente' || p === 'urgente' || p === 'alta';
        return !hasResp && !isUrg && s === 'pendente';
      });
      const aPend = agendamentos.filter(a => (a.status || '').toLowerCase() === 'pendente');
      return [...tPend, ...aPend].sort((a, b) => new Date(b.created_at || (b as any).data_agendamento || 0).getTime() - new Date(a.created_at || (a as any).data_agendamento || 0).getTime());
    }

    // filtroAtivo === 'realizados'
    const tReal = triagens.filter(t => {
      const s = (t.status || '').toLowerCase();
      const as = ((t as any).agendamento_status || '').toLowerCase();
      return s === 'realizado' || as === 'realizado';
    });
    const aReal = agendamentos.filter(a => {
      const s = (a.status || '').toLowerCase();
      const as = ((a as any).agendamento_status || '').toLowerCase();
      return s === 'realizado' || as === 'realizado';
    });
    return [...tReal, ...aReal].sort((a, b) => new Date(b.created_at || (b as any).data_agendamento || 0).getTime() - new Date(a.created_at || (a as any).data_agendamento || 0).getTime());
  }, [triagens, agendamentos, filtroAtivo]);

  const casosPendentes = useMemo(() => {
    return triagens
      .filter(t => {
        const status = (t.status || 'pendente').toLowerCase();
        const prio = (t.prioridade || 'normal').toLowerCase();
        const respondido = (t.respostas && t.respostas.length > 0) || status === 'respondido';
        // Apenas casos urgentes ou de alta prioridade que NÃO foram respondidos
        const isUrgente = status === 'urgente' || prio === 'urgente' || prio === 'alta';
        return !respondido && isUrgente;
      })
      .sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, 5);
  }, [triagens]);

  const abrirCaso = (triagem: Triagem) => navigation.getParent<any>()?.navigate('CasoDetalhe', { triagemId: triagem.id });
  const abrirPaciente = (agendamento: Agendamento) => {
    if (!agendamento.paciente_id) return;
    navigation.getParent<any>()?.navigate('PacienteHistorico', { pacienteId: agendamento.paciente_id, pacienteNome: agendamento.paciente?.nome });
  };

  const handleQuickAction = (screen?: string) => {
    if (!screen) return;
    if (screen === 'CadastrarPaciente') {
      navigation.getParent<any>()?.navigate('CadastrarPaciente');
    } else if (['Agenda', 'Mensagens', 'Pacientes'].includes(screen)) {
      navigation.navigate(screen as any);
    }
    // 'Dashboard' actions stay on current screen (filter change)
  };

  const renderListItem = ({ item }: { item: ListaItem }) => {
    if ('data_agendamento' in item) {
      const agendamento = item as Agendamento;
      const statusLower = (agendamento.status || 'pendente').toLowerCase();
      const prioLower = ((agendamento as any).prioridade || 'normal').toLowerCase();
      
      // Check if patient has any responded triage
      const isRespondido = triagens.some(t => 
        t.paciente_id === agendamento.paciente_id && 
        ((t.respostas && t.respostas.length > 0) || (t.status || '').toLowerCase() === 'respondido')
      );

      // Check if this case is urgent (by status or prioridade)
      const isUrgente = statusLower === 'urgente' || prioLower === 'urgente' || prioLower === 'alta';

      // Urgente tem prioridade máxima na badge, seguido por Realizado
      const statusAg = ((item as any).agendamento_status || '').toLowerCase();
      const effectiveStatus = isUrgente 
        ? 'urgente'
        : (statusLower === 'realizado' || statusAg === 'realizado')
          ? 'realizado'
          : isRespondido 
            ? 'respondido'
            : statusLower;

      const statusInfo = (effectiveStatus === 'urgente' ? STATUS_TRIAGEM.urgente : effectiveStatus === 'respondido' ? STATUS_TRIAGEM.respondido : (STATUS_AGENDAMENTO[effectiveStatus] || STATUS_AGENDAMENTO.pendente));
      return (
        <TouchableOpacity style={styles.card} onPress={() => abrirPaciente(item as Agendamento)}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{(item as Agendamento).paciente?.nome || 'Paciente'}</Text>
            <View style={[styles.badgeContainer, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={statusInfo.icon as any} size={12} color={COLORS.textInverse} />
              <Text style={styles.badgeText}>{statusInfo.label}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{TIPOS_CONSULTA[item.tipo || 'consulta']?.label || 'Consulta'} · {formatRelativeTime(item.data_agendamento)}</Text>
        </TouchableOpacity>
      );
    }

    const triagem = item as Triagem;
    const temRespostas = triagem.respostas && triagem.respostas.length > 0;
    const ultimaResposta = temRespostas ? triagem.respostas![0] : null;

    const statusLower = (triagem.status || 'pendente').toLowerCase();
    const prioLower = (triagem.prioridade || 'normal').toLowerCase();

    // Se tem respostas OU o status é explicitamente respondido/completo
    const isRespondido = temRespostas || statusLower === 'respondido' || statusLower === 'completo';

    // Urgente tem prioridade máxima
    const isUrgente = statusLower === 'urgente' || prioLower === 'urgente' || prioLower === 'alta';

    const effectiveStatus = isUrgente 
      ? 'urgente' 
      : isRespondido 
        ? 'respondido' 
        : (STATUS_TRIAGEM[statusLower] ? statusLower : 'pendente');

    const statusInfo = STATUS_TRIAGEM[effectiveStatus] || STATUS_TRIAGEM.pendente;
    const prioridade = PRIORIDADE[prioLower] || PRIORIDADE.normal;
    
    return (
      <TouchableOpacity style={styles.card} onPress={() => abrirCaso(triagem)}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{triagem.paciente?.nome || 'Paciente'}</Text>
          <View style={[styles.badgeContainer, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color={COLORS.textInverse} />
            <Text style={styles.badgeText}>{statusInfo.label}</Text>
          </View>
        </View>
        <Text style={styles.meta}>{triagem.sintoma_principal || 'Sem sintoma'} · {formatRelativeTime(triagem.created_at)}</Text>
        
        {temRespostas && ultimaResposta && (
          <View style={styles.responseSummary}>
            <View style={styles.responseHeader}>
              <Ionicons name="person-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.responseTextDentista}>
                Dr(a). {ultimaResposta.dentista?.nome?.split(' ')[0] || 'Dentista'}
              </Text>
            </View>
            <View style={styles.responseMain}>
              <View style={styles.recommendationRow}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.recommendationText}>{ultimaResposta.recomendacao || 'Análise concluída'}</Text>
              </View>
              <Text style={styles.observationText} numberOfLines={2}>
                {ultimaResposta.orientacao || ultimaResposta.observacoes || 'Sem observações adicionais'}
              </Text>
            </View>
          </View>
        )}
        
        {!temRespostas && (
          <Text style={[styles.priority, { color: prioridade.color }]}>{prioridade.label}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const header = (
    <View>
      {/* Specialty Header */}
      <View style={[styles.specHeader, { backgroundColor: COLORS.primary }]}>
        <View style={styles.specHeaderContent}>
          <View style={[styles.specIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Ionicons name={specConfig.icon as any} size={28} color="white" />
          </View>
          <View style={styles.specInfo}>
            <Text style={styles.specGreeting}>Olá, Dr(a). {profile?.nome?.split(' ')[0] || 'Dentista'}</Text>
            <Text style={styles.specLabel}>{specConfig.label}</Text>
            <Text style={styles.specDesc}>{specConfig.descricao}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions por Especialidade */}
      <View style={styles.quickActions}>
        {specConfig.acoesRapidas.map((acao, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.quickActionBtn}
            onPress={() => handleQuickAction(acao.screen)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name={acao.icon as any} size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.quickActionLabel} numberOfLines={1}>{acao.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Metrics Grid */}
      <View style={styles.grid}>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: COLORS.primary }]}>{agendaHoje.length}</Text>
          <Text style={styles.metricLabel}>Agenda do dia</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: dashboard.atrasados.length > 0 ? COLORS.danger : COLORS.primary }]}>
            {dashboard.atrasados.length}
          </Text>
          <Text style={styles.metricLabel}>Em atraso</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: contadores.urgente > 0 ? COLORS.danger : COLORS.primary }]}>
            {contadores.urgente}
          </Text>
          <Text style={styles.metricLabel}>Urgentes</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: COLORS.success }]}>{contadores.respondido}</Text>
          <Text style={styles.metricLabel}>Respondidos</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: COLORS.secondary }]}>{contadores.realizados}</Text>
          <Text style={styles.metricLabel}>Realizados</Text>
        </View>
      </View>



      {/* Próximos atendimentos */}
      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Ionicons name="time" size={18} color={COLORS.primary} />
          <Text style={styles.blockTitle}>Próximos atendimentos</Text>
        </View>
        {dashboard.proximos.length === 0 ? (
          <Text style={styles.empty}>Nenhum agendado para hoje.</Text>
        ) : (
          dashboard.proximos.map((item) => (
            <TouchableOpacity key={item.id} style={styles.line} onPress={() => abrirPaciente(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineTitle}>{item.paciente?.nome || 'Paciente'}</Text>
                <Text style={styles.lineMeta}>
                  {new Date(item.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {TIPOS_CONSULTA[item.tipo || 'consulta']?.label || 'Consulta'}
                </Text>
              </View>
              <View style={styles.timeChip}>
                <Text style={styles.timeChipText}>
                  {Math.max(0, Math.round((new Date(item.data_agendamento).getTime() - Date.now()) / 60000))} min
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Financeiro */}
      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
          <Text style={styles.blockTitle}>Financeiro e indicadores</Text>
        </View>
        <View style={styles.finRow}>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Receita hoje</Text>
            <Text style={[styles.finValue, { color: COLORS.primary }]}>{currency(dashboard.receitaHoje)}</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Receita semana</Text>
            <Text style={[styles.finValue, { color: COLORS.primary }]}>{currency(dashboard.receitaSemana)}</Text>
          </View>
        </View>
        <View style={styles.finRow}>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Pacientes atendidos</Text>
            <Text style={styles.finDetail}>{dashboard.atendidosHoje} hoje / {dashboard.atendidosSemana} semana</Text>
          </View>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>Taxa de faltas</Text>
            <Text style={[styles.finDetail, dashboard.taxaFaltas > 20 ? { color: COLORS.danger } : {}]}>
              {dashboard.taxaFaltas.toFixed(0)}% ({dashboard.faltasSemana} faltas)
            </Text>
          </View>
        </View>
        {dashboard.procedimentos.length > 0 && (
          <View style={styles.procSection}>
            <Text style={styles.procTitle}>Procedimentos mais realizados</Text>
            {dashboard.procedimentos.map(([tipo, total]) => (
              <View key={tipo} style={styles.procRow}>
                <View style={[styles.procDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.procText}>{TIPOS_CONSULTA[tipo]?.label || tipo}</Text>
                <Text style={styles.procCount}>{total}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Filtros */}
      <View style={[styles.filters, Platform.OS === 'web' && styles.filtersWeb]}>
        {([
          ['todos', 'Todos', contadores.total],
          ['pendente', Platform.OS === 'web' ? 'Pendente' : 'Pend.', contadores.pendente],
          ['urgente', Platform.OS === 'web' ? 'Urgente' : 'Urg.', contadores.urgente],
          ['respondido', Platform.OS === 'web' ? 'Respondido' : 'Resp.', contadores.respondido],
          ['realizados', Platform.OS === 'web' ? 'Realizados' : 'Realiz.', contadores.realizados],
        ] as const).map(([id, label, count]) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.filter,
              filtroAtivo === id && { backgroundColor: specConfig.color, borderColor: specConfig.color },
              Platform.OS === 'web' && styles.filterWeb
            ]}
            onPress={() => setFiltroAtivo(id)}
          >
            <Text style={[styles.filterText, filtroAtivo === id && styles.filterTextActive]}>
              {label} {count !== undefined ? `(${count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <Ionicons name={specConfig.icon as any} size={48} color={specConfig.color} />
          <Text style={[styles.empty, { marginTop: 12 }]}>Carregando painel...</Text>
        </View>
      ) : (
        <FlatList
          data={dadosFiltrados}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          ListHeaderComponent={header}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.empty}>Nenhum item para este filtro.</Text></View>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          contentContainerStyle={[
            styles.content,
            Platform.OS === 'web' && styles.webContent
          ]}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: COLORS.primary }]}
        onPress={() => navigation.getParent<any>()?.navigate('CadastrarPaciente')}
      >
        <Ionicons name="qr-code-outline" size={20} color={COLORS.textInverse} />
        <Text style={styles.fabText}>Novo Paciente</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 110 },
  webContent: {
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 160, // Increased for web to clear the absolute tab bar
  },

  // Specialty Header
  specHeader: {
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: SIZES.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: SIZES.md,
  },
  specHeaderContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  specIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specInfo: { flex: 1 },
  specGreeting: { color: 'rgba(255,255,255,0.85)', fontSize: SIZES.fontMd },
  specLabel: { color: 'white', fontSize: SIZES.fontXl, fontWeight: '700', marginTop: 2 },
  specDesc: { color: 'rgba(255,255,255,0.7)', fontSize: SIZES.fontSm, marginTop: 2 },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.md,
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  quickActionBtn: { flex: 1, alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: { fontSize: SIZES.fontXs+1, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SIZES.md, paddingHorizontal: SIZES.md },
  metric: {
    width: Platform.OS === 'web' ? '23.5%' : '48%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    ...SHADOWS.sm,
  },
  metricValue: { fontSize: SIZES.fontXxl, fontWeight: '700' },
  metricLabel: { marginTop: 4, fontSize: SIZES.fontSm, color: COLORS.textSecondary },

  // Blocks
  block: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    marginHorizontal: SIZES.md,
    ...SHADOWS.sm,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SIZES.sm },
  blockTitle: { fontSize: SIZES.fontLg, fontWeight: '700', color: COLORS.text },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  lineTitle: { fontSize: SIZES.fontMd, fontWeight: '600', color: COLORS.text },
  lineMeta: { marginTop: 2, fontSize: SIZES.fontSm, color: COLORS.textSecondary },
  timeChip: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
  },
  timeChipText: { fontSize: SIZES.fontSm, fontWeight: '700', color: '#E65100' },

  // Financeiro
  finRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  finItem: { flex: 1 },
  finLabel: { fontSize: SIZES.fontXs+1, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  finValue: { fontSize: SIZES.fontLg, fontWeight: '700', marginTop: 2 },
  finDetail: { fontSize: SIZES.fontSm, color: COLORS.text, marginTop: 2 },
  procSection: { marginTop: SIZES.sm, paddingTop: SIZES.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  procTitle: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  procRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  procDot: { width: 8, height: 8, borderRadius: 4 },
  procText: { flex: 1, fontSize: SIZES.fontSm, color: COLORS.textSecondary },
  procCount: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.text },

  // Filters
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.sm, paddingHorizontal: SIZES.md },
  filter: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterText: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.textInverse },
  filtersWeb: {
    paddingVertical: SIZES.sm,
    flexWrap: 'nowrap',
    overflow: 'scroll',
  },
  filterWeb: {
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
  },

  // Cards
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    marginHorizontal: SIZES.md,
    ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SIZES.sm },
  cardTitle: { flex: 1, fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text },
  meta: { marginTop: 6, fontSize: SIZES.fontSm, color: COLORS.textSecondary },
  badgeContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: SIZES.radiusFull,
    overflow: 'hidden',
  },
  badgeText: { 
    color: COLORS.textInverse, 
    fontSize: Platform.OS === 'web' ? SIZES.fontSm : SIZES.fontXs, 
    fontWeight: '700', 
  },
  priority: { marginTop: 6, fontSize: SIZES.fontSm, fontWeight: '700' },

  responseSummary: {
    marginTop: SIZES.md,
    backgroundColor: '#F1F8E9',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  responseTextDentista: {
    fontSize: SIZES.fontSm,
    fontWeight: '700',
    color: COLORS.success,
  },
  responseMain: {
    gap: 4,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendationText: {
    fontSize: SIZES.fontSm,
    fontWeight: '700',
    color: '#388E3C',
  },
  observationText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Misc
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SIZES.xl },
  empty: { fontSize: SIZES.fontSm, color: COLORS.textSecondary },

  // FAB
  fab: {
    position: 'absolute',
    right: SIZES.lg,
    bottom: Platform.OS === 'web' ? 80 : SIZES.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: SIZES.md,
    paddingVertical: 14,
    ...SHADOWS.lg,
  },
  fabText: { color: COLORS.textInverse, fontSize: SIZES.fontMd, fontWeight: '700' },
});

export default DashboardScreen;
