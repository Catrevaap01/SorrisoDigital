import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { logger } from '../../utils/logger';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { DentistaTabParamList } from '../../navigation/types';
import { Agendamento, ServiceResult, buscarAgendaDentista, buscarAgendamentosDentistaPorPeriodo } from '../../services/agendamentoService';
import { buscarContadoresDentista, buscarTriagensDentista, Contadores, Triagem } from '../../services/triagemService';
import {
  exportarAnamnesePdf,
  exportarHistoricoPacientePdf,
  exportarPlanoTratamentoPdf,
  exportarPrescricaoPdf,
} from '../../services/pdfReportService';
import { COLORS, SHADOWS, SIZES } from '../../styles/theme';
import { PRIORIDADE, STATUS_AGENDAMENTO, STATUS_TRIAGEM, TIPOS_CONSULTA } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';
import { getEspecialidadeConfig, EspecialidadeConfig } from '../../config/specialtyConfig';
import { 
  buscarTratamentosFinanceirosDentista, 
  buildDentistBillingHtml 
} from '../../services/relatorioService';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';

type Props = BottomTabScreenProps<DentistaTabParamList, 'Dashboard'>;
type ListaItem = Triagem | Agendamento;
type DocumentoTipo = 'anamnese' | 'plano' | 'prescricao';

type DocumentoRecente = {
  id: string;
  tipo: DocumentoTipo;
  pacienteId: string;
  pacienteNome: string;
  data: string;
};

type PacienteClinico = {
  pacienteId: string;
  pacienteNome: string;
  triagemId?: string;
};

const CONTADORES_DEFAULT: Contadores = { pendente: 0, urgente: 0, respondido: 0, total: 0, realizados: 0 };
const PRECO_POR_TIPO: Record<string, number> = { consulta: 25000, avaliacao: 30000, retorno: 15000, urgencia: 45000, raio_x: 20000, panoramico: 35000, profilaxia: 22000, branqueamento: 60000, canal: 90000, ortodontia: 120000, restauracao: 40000 };

const currency = (value: number | string | undefined) => {
  const amount = Number(value || 0);
  if (isNaN(amount)) return '0 Kz';
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendaHoje, setAgendaHoje] = useState<Agendamento[]>([]);
  const [contadores, setContadores] = useState<Contadores>(CONTADORES_DEFAULT);
  const [documentosRecentes, setDocumentosRecentes] = useState<DocumentoRecente[]>([]);
  const [tratamentosPendentes, setTratamentosPendentes] = useState(0);
  const [prescricoesEmitidas, setPrescricoesEmitidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'pendente' | 'urgente' | 'respondido' | 'realizados'>('todos');
  const [pacienteSelecionadoId, setPacienteSelecionadoId] = useState<string | undefined>();
  const hasLoadedRef = useRef(false);

  // Configuração por especialidade
  const specConfig: EspecialidadeConfig = useMemo(
    () => getEspecialidadeConfig(profile?.especialidade),
    [profile?.especialidade]
  );

  const carregarDocumentacaoClinica = useCallback(async () => {
    if (!profile?.id) return;

    const [anamnesesRes, planosRes, prescricoesRes, planosIdsRes, prescricoesCountRes] = await Promise.all([
      supabase
        .from('anamneses')
        .select('id, paciente_id, updated_at, created_at')
        .eq('dentista_id', profile?.id)
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase
        .from('planos_tratamento')
        .select('id, paciente_id, updated_at, created_at')
        .eq('dentista_id', profile?.id)
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase
        .from('prescricoes')
        .select('id, paciente_id, created_at')
        .eq('dentista_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('planos_tratamento')
        .select('id')
        .eq('dentista_id', profile?.id),
      supabase
        .from('prescricoes')
        .select('id', { count: 'exact', head: true })
        .eq('dentista_id', profile?.id),
    ]);

    const planos = planosRes.data || [];
    const planoIds = (planosIdsRes.data || []).map((item: any) => item.id).filter(Boolean);
    let procedimentosPendentes = 0;

    if (planoIds.length > 0) {
      const procRes = await supabase
        .from('procedimentos_tratamento')
        .select('id, status, plano_id')
        .in('plano_id', planoIds);
      procedimentosPendentes = (procRes.data || []).filter(
        (item: any) => !['concluido', 'cancelado'].includes(String(item.status || '').toLowerCase())
      ).length;
    }

    const pacienteIds = Array.from(
      new Set(
        [
          ...(anamnesesRes.data || []).map((item: any) => item.paciente_id),
          ...planos.map((item: any) => item.paciente_id),
          ...(prescricoesRes.data || []).map((item: any) => item.paciente_id),
        ].filter(Boolean)
      )
    ) as string[];

    let pacientesById: Record<string, string> = {};
    if (pacienteIds.length > 0) {
      const pacientesRes = await supabase
        .from('profiles')
        .select('id, nome')
        .in('id', pacienteIds);
      pacientesById = Object.fromEntries((pacientesRes.data || []).map((item: any) => [item.id, item.nome || 'Paciente']));
    }

    const recentes: DocumentoRecente[] = [
      ...(anamnesesRes.data || []).map((item: any) => ({
        id: `anamnese-${item.id}`,
        tipo: 'anamnese' as const,
        pacienteId: item.paciente_id,
        pacienteNome: pacientesById[item.paciente_id] || 'Paciente',
        data: item.updated_at || item.created_at,
      })),
      ...planos.map((item: any) => ({
        id: `plano-${item.id}`,
        tipo: 'plano' as const,
        pacienteId: item.paciente_id,
        pacienteNome: pacientesById[item.paciente_id] || 'Paciente',
        data: item.updated_at || item.created_at,
      })),
      ...(prescricoesRes.data || []).map((item: any) => ({
        id: `prescricao-${item.id}`,
        tipo: 'prescricao' as const,
        pacienteId: item.paciente_id,
        pacienteNome: pacientesById[item.paciente_id] || 'Paciente',
        data: item.created_at,
      })),
    ]
      .filter((item) => !!item.pacienteId)
      .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
      .slice(0, 6);

    setDocumentosRecentes(recentes);
    setTratamentosPendentes(procedimentosPendentes);
    setPrescricoesEmitidas(prescricoesCountRes.count || 0);
  }, [profile?.id]);

  const carregarDados = useCallback(async () => {
    if (!profile?.id) return;
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    const fimSemana = new Date();
    const inicioSemana = new Date();
    inicioSemana.setHours(0, 0, 0, 0);
    inicioSemana.setDate(inicioSemana.getDate() - 30); // Últimos 30 dias
    fimSemana.setDate(fimSemana.getDate() + 60); // Próximos 60 dias

    const [contResult, triResult, agResult, hojeResult] = await Promise.all([
      buscarContadoresDentista(profile?.id).catch(e => ({ success: false, data: CONTADORES_DEFAULT, error: e.message })),
      buscarTriagensDentista(profile?.id).catch(e => ({ success: false, data: [], error: e.message })),
      buscarAgendamentosDentistaPorPeriodo(profile?.id, inicioSemana, fimSemana).catch(e => ({ success: false, data: [], error: e.message })),
      buscarAgendaDentista(profile?.id, new Date()).catch(e => ({ success: false, data: [], error: e.message }))
    ]);

    setContadores(contResult.success ? contResult.data ?? CONTADORES_DEFAULT : CONTADORES_DEFAULT);
    setTriagens(triResult.success ? triResult.data ?? [] : []);
    setAgendamentos(agResult.success ? agResult.data ?? [] : []);
    setAgendaHoje(hojeResult.success ? hojeResult.data ?? [] : []);

    const errors = [contResult, triResult, agResult, hojeResult].filter(r => !r.success).length;
    if (errors > 0) {
      logger.warn(`Dashboard: ${errors}/4 services failed on ${Platform.OS}, showing partial data`);
    }

    await carregarDocumentacaoClinica();
    hasLoadedRef.current = true;
    setLoading(false);
  }, [carregarDocumentacaoClinica, profile?.id]);

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
    const agendaSemana = agendamentos.filter((item) => new Date(item.appointment_date || 0) >= weekStart);
    const realizadosHoje = agendaHoje.filter((item) => item.status === 'realizado');
    const realizadosSemana = agendaSemana.filter((item) => item.status === 'realizado');
    const canceladosSemana = agendaSemana.filter((item) => item.status === 'cancelado');
    const proximos = [...agendaHoje]
      .filter((item) => ['agendado', 'confirmado', 'confirmado_paciente', 'notificado_paciente', 'atribuido_dentista'].includes(item.status || '') && new Date(item.appointment_date || 0) >= now)
      .sort((a, b) => new Date(a.appointment_date || 0).getTime() - new Date(b.appointment_date || 0).getTime())
      .slice(0, 3);
    const atrasados = agendaHoje.filter((item) => ['agendado', 'confirmado', 'confirmado_paciente', 'notificado_paciente'].includes(item.status || '') && new Date(item.appointment_date || 0) < now);
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
      atendidosHoje: new Set(realizadosHoje.map((item) => item.patient_id).filter(Boolean)).size,
      atendidosSemana: new Set(realizadosSemana.map((item) => item.patient_id).filter(Boolean)).size,
      procedimentos,
      taxaFaltas,
    };
  }, [agendaHoje, agendamentos]);

  const pacienteFoco = useMemo(() => {
    const proximoAgendamento = [...agendaHoje]
      .sort((a, b) => new Date(a.appointment_date || 0).getTime() - new Date(b.appointment_date || 0).getTime())
      .find((item) => !!item.patient_id);

    const triagemRelacionada = triagens.find((item) => item.paciente_id === proximoAgendamento?.patient_id)
      || triagens.find((item) => !!item.paciente_id);

    const pacienteId = triagemRelacionada?.paciente_id || proximoAgendamento?.patient_id;
    const pacienteNome =
      triagemRelacionada?.paciente?.nome ||
      proximoAgendamento?.paciente?.nome ||
      documentosRecentes.find((item) => item.pacienteId === pacienteId)?.pacienteNome;

    return {
      pacienteId,
      pacienteNome: pacienteNome || 'Paciente',
      triagemId: triagemRelacionada?.id,
    };
  }, [agendaHoje, documentosRecentes, triagens]);

  const pacientesClinicos = useMemo<PacienteClinico[]>(() => {
    const pacientesMap = new Map<string, PacienteClinico>();

    triagens.forEach((item) => {
      if (!item.paciente_id) return;
      pacientesMap.set(item.paciente_id, {
        pacienteId: item.paciente_id,
        pacienteNome: item.paciente?.nome || documentosRecentes.find((doc) => doc.pacienteId === item.paciente_id)?.pacienteNome || 'Paciente',
        triagemId: item.id,
      });
    });

    agendaHoje.forEach((item) => {
      if (!item.patient_id || pacientesMap.has(item.patient_id)) return;
      pacientesMap.set(item.patient_id, {
        pacienteId: item.patient_id,
        pacienteNome: item.paciente?.nome || documentosRecentes.find((doc) => doc.pacienteId === item.patient_id)?.pacienteNome || 'Paciente',
      });
    });

    documentosRecentes.forEach((item) => {
      if (!item.pacienteId || pacientesMap.has(item.pacienteId)) return;
      pacientesMap.set(item.pacienteId, {
        pacienteId: item.pacienteId,
        pacienteNome: item.pacienteNome || 'Paciente',
      });
    });

    return Array.from(pacientesMap.values()).sort((a, b) => a.pacienteNome.localeCompare(b.pacienteNome));
  }, [agendaHoje, documentosRecentes, triagens]);

  useEffect(() => {
    if (!pacientesClinicos.length) {
      if (pacienteSelecionadoId) setPacienteSelecionadoId(undefined);
      return;
    }

    const pacienteValido = pacientesClinicos.some((item) => item.pacienteId === pacienteSelecionadoId);
    if (pacienteValido) return;

    setPacienteSelecionadoId(pacienteFoco.pacienteId || pacientesClinicos[0]?.pacienteId);
  }, [pacienteFoco.pacienteId, pacienteSelecionadoId, pacientesClinicos]);

  const pacienteClinicoAtivo = useMemo(() => {
    return pacientesClinicos.find((item) => item.pacienteId === pacienteSelecionadoId) || (
      pacienteFoco.pacienteId
        ? {
            pacienteId: pacienteFoco.pacienteId,
            pacienteNome: pacienteFoco.pacienteNome,
            triagemId: pacienteFoco.triagemId,
          }
        : undefined
    );
  }, [pacienteFoco.pacienteId, pacienteFoco.pacienteNome, pacienteFoco.triagemId, pacienteSelecionadoId, pacientesClinicos]);

  const resolverTriagemPaciente = useCallback(async (pacienteId?: string) => {
    if (!pacienteId) return undefined;

    const triagemLocal = triagens.find((item) => item.paciente_id === pacienteId)?.id;
    if (triagemLocal) return triagemLocal;

    const { data } = await supabase
      .from('triagens')
      .select('id')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.id;
  }, [triagens]);

  const removerAtribuicao = useCallback(async (pacienteId: string) => {
    try {
      // Remove from triagens (set dentista_id to null)
      const { error: triagemError } = await supabase
        .from('triagens')
        .update({ dentista_id: null })
        .eq('paciente_id', pacienteId)
        .eq('dentista_id', profile?.id);

      // Remove from agendamentos (set dentist_id to null)
      const { error: agendamentoError } = await supabase
        .from('agendamentos')
        .update({ dentist_id: null })
        .eq('patient_id', pacienteId)
        .eq('dentist_id', profile?.id);

      if (triagemError || agendamentoError) {
        Toast.show({
          type: 'error',
          text1: 'Erro ao remover atribuição',
          text2: 'Tente novamente.',
        });
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Atribuição removida',
        text2: 'Paciente desvinculado com sucesso.',
      });
      
      // Refresh data
      onRefresh?.();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao remover atribuição',
        text2: 'Tente novamente.',
      });
    }
  }, [profile?.id, onRefresh]);

  const abrirModuloClinico = useCallback(async (screen: 'Anamnese' | 'PlanoTratamento' | 'Prescricao') => {
    // Check if there's any patient assigned by secretary (triagem or agendamento)
    const pacienteAtribuido = pacientesClinicos.length > 0 ? pacientesClinicos[0] : null;
    
    if (!pacienteAtribuido?.pacienteId && !pacienteClinicoAtivo?.pacienteId) {
      Toast.show({
        type: 'info',
        text1: 'Nenhum paciente selecionado',
        text2: 'Escolha o paciente antes de abrir o modulo clinico.',
      });
      return;
    }

    // Use assigned patient if no patient is actively selected
    const pacienteAtivo = pacienteClinicoAtivo?.pacienteId ? pacienteClinicoAtivo : pacienteAtribuido;
    
    if (!pacienteAtivo?.pacienteId) {
      Toast.show({
        type: 'info',
        text1: 'Nenhum paciente disponível',
        text2: 'Nenhum paciente atribuído encontrado.',
      });
      return;
    }

    const triagemId = pacienteAtivo.triagemId || await resolverTriagemPaciente(pacienteAtivo.pacienteId);
    if (!triagemId) {
      Toast.show({
        type: 'info',
        text1: 'Triagem não encontrada',
        text2: 'Este paciente ainda não possui triagem vinculada.',
      });
      return;
    }

    navigation.getParent<any>()?.navigate(screen, {
      triagemId,
      pacienteId: pacienteAtivo.pacienteId,
      pacienteNome: pacienteAtivo.pacienteNome,
    });
  }, [navigation, pacienteClinicoAtivo, pacientesClinicos, resolverTriagemPaciente]);

  const handleImprimirFaturacao = useCallback(async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const res = await buscarTratamentosFinanceirosDentista(profile?.id);
      if (!res.success) throw new Error(res.error);
      
      const html = buildDentistBillingHtml(profile.nome || 'Dentista', res.data || []);
      const pdfRes = await exportHtmlAsPdf(html, `faturacao-${profile.nome?.split(' ')[0]}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      if (!pdfRes.success) throw new Error(pdfRes.error);
      Toast.show({ type: 'success', text1: 'Relatório gerado com sucesso' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro ao gerar relatório', text2: error.message });
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const gerarPdfDocumento = useCallback(async (tipo: DocumentoTipo | 'historico', pacienteId?: string) => {
    const alvoPacienteId = pacienteId || pacienteClinicoAtivo?.pacienteId;
    if (!alvoPacienteId) {
      Toast.show({ type: 'info', text1: 'Nenhum paciente disponível para PDF' });
      return;
    }

    const result = tipo === 'anamnese'
      ? await exportarAnamnesePdf(alvoPacienteId)
      : tipo === 'plano'
        ? await exportarPlanoTratamentoPdf(alvoPacienteId)
        : tipo === 'prescricao'
          ? await exportarPrescricaoPdf(alvoPacienteId)
          : await exportarHistoricoPacientePdf(alvoPacienteId);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao gerar PDF', text2: result.error || 'Tente novamente' });
      return;
    }

    Toast.show({ type: 'success', text1: 'PDF pronto' });
  }, [pacienteClinicoAtivo?.pacienteId]);

  const dadosFiltrados: ListaItem[] = useMemo(() => {
    if (filtroAtivo === 'todos') {
      const filteredAgendamentos = agendamentos.filter(a => {
        const s = (a.status || '').toLowerCase();
        return ['agendado', 'confirmado', 'realizado', 'pendente', 'urgente', 'atribuido_dentista'].includes(s);
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
        const hasResp = (t.respostas && t.respostas.length > 0) || s === 'respondido' || s === 'completo';
        const isUrg = s === 'urgente' || p === 'urgente' || p === 'alta' || Number((t as any).intensidade_dor || 0) > 6;
        return isUrg && !hasResp && s !== 'realizado';
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
        const isUrg = s === 'urgente' || p === 'urgente' || p === 'alta' || Number((t as any).intensidade_dor || 0) > 6;
        return !hasResp && !isUrg && s === 'pendente';
      });
      const aPend = agendamentos.filter(a => {
        const status = (a.status || '').toLowerCase();
        const altStatus = ((a as any).agendamento_status || '').toLowerCase();
        return status === 'solicitado' || altStatus === 'solicitado' || status === 'atribuido_dentista';
      });
      return [...tPend, ...aPend].sort((a, b) => new Date(b.created_at || (b as any).data_agendamento || 0).getTime() - new Date(a.created_at || (a as any).data_agendamento || 0).getTime());
    }

    // filtroAtivo === 'realizados'
    const aReal = agendamentos.filter(a => {
      const s = (a.status || '').toLowerCase();
      const as = ((a as any).agendamento_status || '').toLowerCase();
      return s === 'realizado' || as === 'realizado';
    });
    return aReal.sort((a, b) => new Date((b as any).data_agendamento || 0).getTime() - new Date((a as any).data_agendamento || 0).getTime());
  }, [triagens, agendamentos, filtroAtivo]);

  const casosPendentes = useMemo(() => {
    return triagens
      .filter(t => {
        const status = (t.status || 'pendente').toLowerCase();
        const prio = (t.prioridade || 'normal').toLowerCase();
        const respondido = (t.respostas && t.respostas.length > 0) || status === 'respondido';
        // Apenas casos urgentes ou de alta prioridade que NÃO foram respondidos
        const isUrgente = status === 'urgente' || prio === 'urgente' || prio === 'alta' || Number((t as any).intensidade_dor || 0) > 6;
        return !respondido && isUrgente;
      })
      .sort((a, b) => {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, 5);
  }, [triagens]);

  const abrirCaso = (triagem: Triagem) => navigation.getParent<any>()?.navigate('CasoDetalhe', { triagemId: triagem.id });
  const abrirPaciente = (agendamento: Agendamento) => {
    if (!agendamento.patient_id) return;
    navigation.getParent<any>()?.navigate('PacienteHistorico', { pacienteId: agendamento.patient_id, pacienteNome: agendamento.paciente?.nome });
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
    // Garantir que não confundimos uma Triagem (que pode ter data_agendamento preenchida) com um Agendamento
    if ('data_agendamento' in item && !('sintoma_principal' in item)) {
      const agendamento = item as Agendamento;
      const statusLower = (agendamento.status || 'pendente').toLowerCase();
      const prioLower = ((agendamento as any).prioridade || 'normal').toLowerCase();

      const isUrgente = statusLower === 'urgente' || prioLower === 'urgente' || prioLower === 'alta';
      const statusAg = ((item as any).agendamento_status || '').toLowerCase();

      const effectiveStatus = isUrgente
        ? 'urgente'
        : (statusLower === 'realizado' || statusAg === 'realizado')
          ? 'realizado'
          : statusLower;

      const statusInfo = (effectiveStatus === 'urgente' ? STATUS_TRIAGEM.urgente : (STATUS_AGENDAMENTO[effectiveStatus] || STATUS_AGENDAMENTO.pendente));
      return (
        <TouchableOpacity style={styles.card} onPress={() => abrirPaciente(item as Agendamento)}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{(item as Agendamento).paciente?.nome || 'Paciente'}</Text>
            <View style={[styles.badgeContainer, { backgroundColor: statusInfo.color }]}>
              <Ionicons name={statusInfo.icon as any} size={12} color={COLORS.textInverse} />
              <Text style={styles.badgeText}>{statusInfo.label}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{TIPOS_CONSULTA[item.tipo || 'consulta']?.label || 'Consulta'} · {formatRelativeTime(item.appointment_date)}</Text>
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
    const isUrgente = statusLower === 'urgente' || prioLower === 'urgente' || prioLower === 'alta' || Number((triagem as any).intensidade_dor || 0) > 6;

    const effectiveStatus = isRespondido
      ? 'respondido'
      : isUrgente
        ? 'urgente'
        : 'pendente';

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
                Dr(a). {ultimaResposta.dentista?.nome?.split(' ')[0] || profile?.nome?.split(' ')[0] || 'Dentista'}
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
            <Text style={styles.specLabel}>{profile?.especialidade || specConfig.label}</Text>
            <Text style={styles.specDesc}>{profile?.descricao || specConfig.descricao}</Text>
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
          <Text style={styles.metricLabel}>Consultas hoje</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: contadores.pendente > 0 ? COLORS.danger : COLORS.primary }]}>
            {contadores.pendente}
          </Text>
          <Text style={styles.metricLabel}>Pacientes em espera</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: tratamentosPendentes > 0 ? '#C2410C' : COLORS.primary }]}>
            {tratamentosPendentes}
          </Text>
          <Text style={styles.metricLabel}>Tratamentos pendentes</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricValue, { color: '#BE185D' }]}>{prescricoesEmitidas}</Text>
          <Text style={styles.metricLabel}>Prescrições emitidas</Text>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
          <Text style={styles.blockTitle}>Documentação clínica</Text>
        </View>
        <Text style={styles.blockSubtext}>
          {pacienteFoco.pacienteId
            ? `Paciente em foco: ${pacienteFoco.pacienteNome}`
            : 'Sem paciente em foco. Selecione um caso para abrir os módulos clínicos.'}
        </Text>

        {pacientesClinicos.length > 0 && (
          <View style={styles.patientSelector}>
            {pacientesClinicos.map((item) => {
              const ativo = item.pacienteId === pacienteClinicoAtivo?.pacienteId;
              return (
                <View key={item.pacienteId} style={[styles.patientChipContainer, ativo && styles.patientChipContainerActive]}>
                  <TouchableOpacity
                    style={[styles.patientChip, ativo && styles.patientChipActive]}
                    onPress={() => setPacienteSelecionadoId(item.pacienteId)}
                  >
                    <Text style={[styles.patientChipText, ativo && styles.patientChipTextActive]}>
                      {item.pacienteNome}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeAssignmentBtn}
                    onPress={() => removerAtribuicao(item.pacienteId)}
                  >
                    <Ionicons name="close-circle" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {!!pacienteClinicoAtivo?.pacienteId && (
          <Text style={styles.patientSelectionHint}>Paciente escolhido para abrir e guardar documentos: {pacienteClinicoAtivo.pacienteNome}</Text>
        )}

        <View style={styles.modulesGrid}>
          <View style={[styles.moduleCard, styles.moduleCardAnamnese]}>
            <View style={[styles.moduleIconWrap, styles.moduleIconWrapAnamnese]}>
              <Ionicons name="clipboard-outline" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.moduleEyebrow}>Anamnese</Text>
            <Text style={styles.moduleTitle}>Histórico clínico</Text>
            <Text style={styles.moduleText}>Queixa principal, alergias, medicamentos e observações.</Text>
            <View style={styles.moduleActions}>
              <TouchableOpacity style={styles.moduleGhostBtn} onPress={() => abrirModuloClinico('Anamnese')}>
                <Text style={styles.moduleGhostText}>Abrir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modulePrimaryBtn} onPress={() => void gerarPdfDocumento('anamnese')}>
                <Text style={styles.modulePrimaryText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.moduleCard, styles.moduleCardPlano]}>
            <View style={[styles.moduleIconWrap, styles.moduleIconWrapPlano]}>
              <Ionicons name="medkit-outline" size={20} color="#0F766E" />
            </View>
            <Text style={styles.moduleEyebrow}>Plano</Text>
            <Text style={styles.moduleTitle}>Plano de tratamento</Text>
            <Text style={styles.moduleText}>Procedimentos, sessões, estado e soma total por paciente.</Text>
            <View style={styles.moduleActions}>
              <TouchableOpacity style={styles.moduleGhostBtn} onPress={() => abrirModuloClinico('PlanoTratamento')}>
                <Text style={styles.moduleGhostText}>Abrir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modulePrimaryBtn} onPress={() => void gerarPdfDocumento('plano')}>
                <Text style={styles.modulePrimaryText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.moduleCard, styles.moduleCardPrescricao]}>
            <View style={[styles.moduleIconWrap, styles.moduleIconWrapPrescricao]}>
              <Ionicons name="medical-outline" size={20} color="#BE185D" />
            </View>
            <Text style={styles.moduleEyebrow}>Prescrição</Text>
            <Text style={styles.moduleTitle}>Receituário</Text>
            <Text style={styles.moduleText}>Medicamentos, dose, frequência, duração e assinatura clínica.</Text>
            <View style={styles.moduleActions}>
              <TouchableOpacity style={styles.moduleGhostBtn} onPress={() => abrirModuloClinico('Prescricao')}>
                <Text style={styles.moduleGhostText}>Abrir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modulePrimaryBtn} onPress={() => void gerarPdfDocumento('prescricao')}>
                <Text style={styles.modulePrimaryText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Ionicons name="albums-outline" size={18} color={COLORS.primary} />
          <Text style={styles.blockTitle}>Documentos recentes</Text>
        </View>
        {documentosRecentes.length === 0 ? (
          <Text style={styles.empty}>Nenhum documento recente.</Text>
        ) : (
          documentosRecentes.map((item) => (
            <TouchableOpacity key={item.id} style={styles.docLine} onPress={() => void gerarPdfDocumento(item.tipo, item.pacienteId)}>
              <View style={styles.docIcon}>
                <Ionicons
                  name={item.tipo === 'anamnese' ? 'clipboard-outline' : item.tipo === 'plano' ? 'medkit-outline' : 'medical-outline'}
                  size={16}
                  color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineTitle}>
                  {item.tipo === 'anamnese' ? 'Anamnese' : item.tipo === 'plano' ? 'Plano' : 'Prescrição'} - {item.pacienteNome}
                </Text>
                <Text style={styles.lineMeta}>{formatRelativeTime(item.data)}</Text>
              </View>
              <Ionicons name="document-attach-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))
        )}
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
                  {new Date(item.appointment_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {TIPOS_CONSULTA[item.tipo || 'consulta']?.label || 'Consulta'}
                </Text>
              </View>
              <View style={styles.timeChip}>
                <Text style={styles.timeChipText}>
                  {Math.max(0, Math.round((new Date(item.appointment_date).getTime() - Date.now()) / 60000))} min
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
        
        <TouchableOpacity style={styles.printBillingBtn} onPress={() => void handleImprimirFaturacao()}>
          <Ionicons name="print-outline" size={14} color="white" />
          <Text style={styles.printBillingBtnText}>Imprimir Relatório de Faturação</Text>
        </TouchableOpacity>
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
          ['todos', 'Todos'],
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
  quickActionLabel: { fontSize: SIZES.fontXs + 1, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

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
  blockSubtext: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginBottom: SIZES.md },
  patientSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    marginBottom: SIZES.md,
  },
  patientChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  patientChipContainerActive: {
    backgroundColor: COLORS.primary,
  },
  patientChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  patientChipActive: {
    backgroundColor: 'transparent',
  },
  patientChipText: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
    fontWeight: '700',
  },
  patientChipTextActive: {
    color: COLORS.textInverse,
  },
  removeAssignmentBtn: {
    marginLeft: 4,
    padding: 2,
  },
  patientSelectionHint: {
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
    fontWeight: '700',
    marginBottom: SIZES.md,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.sm,
    justifyContent: 'space-between',
  },
  moduleCard: {
    width: Platform.OS === 'web' ? '32%' : '100%',
    minHeight: Platform.OS === 'web' ? 230 : 210,
    backgroundColor: '#FCFCFD',
    borderRadius: 24,
    padding: SIZES.md + 2,
    borderWidth: 1,
    borderColor: '#E7EDF5',
    ...SHADOWS.sm,
  },
  moduleCardAnamnese: {
    backgroundColor: '#FCFAFF',
  },
  moduleCardPlano: {
    backgroundColor: '#F8FFFE',
  },
  moduleCardPrescricao: {
    backgroundColor: '#FFF9FC',
  },
  moduleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  moduleIconWrapAnamnese: {
    backgroundColor: '#F5F1FF',
    borderColor: '#E9DDFF',
  },
  moduleIconWrapPlano: {
    backgroundColor: '#ECFDF5',
    borderColor: '#CFF6E2',
  },
  moduleIconWrapPrescricao: {
    backgroundColor: '#FDF2F8',
    borderColor: '#F8D7E7',
  },
  moduleEyebrow: {
    fontSize: SIZES.fontXs,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  moduleTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  moduleText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginTop: 8,
    minHeight: 64,
  },
  moduleActions: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: 'auto',
    paddingTop: SIZES.md,
  },
  moduleGhostBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radiusFull,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E0EA',
  },
  moduleGhostText: {
    color: COLORS.text,
    fontSize: SIZES.fontSm,
    fontWeight: '700',
  },
  modulePrimaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radiusFull,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
  },
  modulePrimaryText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontSm,
    fontWeight: '700',
  },
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
  docLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },

  // Financeiro
  finRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  finItem: { flex: 1 },
  finLabel: { fontSize: SIZES.fontXs + 1, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  finValue: { fontSize: SIZES.fontLg, fontWeight: '700', marginTop: 2 },
  finDetail: { fontSize: SIZES.fontSm, color: COLORS.text, marginTop: 2 },
  procSection: { marginTop: SIZES.sm, paddingTop: SIZES.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  procTitle: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  procRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  procDot: { width: 8, height: 8, borderRadius: 4 },
  procText: { flex: 1, fontSize: SIZES.fontSm, color: COLORS.textSecondary },
  procCount: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.text },

  printBillingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: SIZES.md,
    alignSelf: 'flex-start',
    ...SHADOWS.md,
  },
  printBillingBtnText: {
    color: 'white',
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },

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
