import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { buscarTodosAgendamentosDentista } from '../../services/agendamentoService';
import { buscarPaciente, listarPacientes } from '../../services/pacienteService';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';
import Loading from '../../components/ui/Loading';
import { gerarFichaHistorico } from './gerarFichaHistorico';
import { buscarTratamentosFinanceirosDentista, buildDentistBillingHtml } from '../../services/relatorioService';

interface PacienteListItem {
  id: string;
  nome: string;
  data_nascimento?: string;
  genero?: string;
  created_at?: string;
}

const normalizarId = (valor?: string | null) => (valor || '').trim().toLowerCase();

const DentistaRelatorioScreen: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [pacientesList, setPacientesList] = useState<PacienteListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const [agResult, pacResult] = await Promise.all([
        buscarTodosAgendamentosDentista(profile.id),
        listarPacientes({ limit: 500 })
      ]);

      if (!agResult.success) {
        const errMsg = typeof agResult.error === 'string' ? agResult.error : agResult.error?.message || 'Falha nos agendamentos';
        Toast.show({ type: 'error', text1: 'Erro ao carregar agendamentos', text2: errMsg });
        setError(errMsg);
        setAgendamentos([]);
      } else {
        setAgendamentos(agResult.data || []);
      }

      if (!pacResult.success) {
        Toast.show({ type: 'error', text1: 'Erro ao carregar pacientes', text2: pacResult.error || 'Falha' });
        setPacientesList([]);
      } else {
        const dentistaId = normalizarId(profile.id);
        const pacientesAtribuidos = (pacResult.data || []).filter(
          (p) => normalizarId(p.dentist_id) === dentistaId || normalizarId(p.dentista_id) === dentistaId
        );
        const list = pacientesAtribuidos.map(p => ({
          id: p.id,
          nome: p.nome || 'Paciente sem nome',
          data_nascimento: p.data_nascimento,
          genero: p.genero,
          created_at: (p as any).created_at || new Date().toISOString()
        }));
        setPacientesList(list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (error: any) {
      const errMsg = 'Erro de conexão - Verifique sua internet';
      Toast.show({
        type: 'error',
        text1: 'Erro de conexão',
        text2: errMsg
      });
      setError(errMsg);
      setAgendamentos([]);
      setPacientesList([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  const gerarPdfAgendamentos = async () => {
    setGerandoPdf(true);
    try {
      const totalConsultas = agendamentos.length;
      const consultasMes = agendamentos.filter((ag: any) => {
        const data = new Date(ag.data_agendamento);
        const agora = new Date();
        return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
      }).length;

      const faturacaoRes = profile?.id ? await buscarTratamentosFinanceirosDentista(profile.id) : { success: false, data: [] };
      const itemsFinanceiros = faturacaoRes.success ? (faturacaoRes.data || []) : [];
      
      // Calcular totais de faturação
      let totalFaturado = 0;
      let totalRecebido = 0;
      itemsFinanceiros.forEach((item: any) => {
        const valor = Number(item.valor || 0);
        const valorPago = item.status_financeiro === 'pago' ? valor : Number(item.valor_pago || 0);
        totalFaturado += valor;
        totalRecebido += valorPago;
      });
      const totalPendente = totalFaturado - totalRecebido;

      // Função para formatar valores em Kwanzas
      const formatarMoeda = (valor: number): string => {
        return new Intl.NumberFormat('pt-AO', {
          style: 'currency',
          currency: 'AOA',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(valor);
      };

      const html = `
        <div class="screen-toolbar no-print">
          <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
          <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
        </div>

        <div class="a4-container">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0284c7; padding-bottom:14px; margin-bottom:20px;">
            <div>
              <div style="font-size:22px; font-weight:800; color:#0369a1; letter-spacing:-0.5px;">🦷 TeOdonto Angola</div>
              <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:3px; text-transform:uppercase;">Relatório Geral de Actividade Clínica & Financeira</div>
              <div style="font-size:11px; color:#64748b; margin-top:2px;">Médico Dentista: <strong>Dr(a). ${profile?.nome || 'Dentista'}</strong> (CRM: ${profile?.crm || 'N/D'})</div>
            </div>
            <div style="text-align:right;">
              <div style="display:inline-block; background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">RELATÓRIO CLÍNICO</div>
              <div style="font-size:10.5px; color:#475569; margin-top:4px;">Emissão: ${new Date().toLocaleDateString('pt-AO')}</div>
              <div style="font-size:10px; color:#64748b;">Especialidade: ${profile?.especialidade || 'Clínica Geral'}</div>
            </div>
          </div>

          <div style="font-size:12px; font-weight:700; color:#0284c7; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            1. INDICADORES GERAIS DE CONSULTAS
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:20px; page-break-inside:avoid;">
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#0284c7; font-size:20px; font-weight:800;">${totalConsultas}</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Total de Consultas</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#0284c7; font-size:20px; font-weight:800;">${consultasMes}</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Consultas Este Mês</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#16a34a; font-size:20px; font-weight:800;">${agendamentos.length > 0 ? Math.round((consultasMes / totalConsultas) * 100) : 0}%</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Produtividade Mensal</div>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:10.5px;">
            <thead>
              <tr style="background:#0284c7; color:#ffffff;">
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Paciente</th>
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Data & Hora</th>
                <th style="padding:8px 10px; text-align:center; font-size:10px;">Status</th>
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Tipo de Atendimento</th>
              </tr>
            </thead>
            <tbody>
              ${agendamentos.slice(0, 30).map((ag: any) => `
                <tr style="page-break-inside:avoid;">
                  <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0f172a;">${ag.paciente?.nome || 'N/D'}</td>
                  <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;">${new Date(ag.data_agendamento).toLocaleString('pt-AO')}</td>
                  <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">
                    <span style="padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; background:#e0f2fe; color:#0369a1;">
                      ${ag.status || 'Realizado'}
                    </span>
                  </td>
                  <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;">${ag.tipo || 'Consulta Odontológica'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="font-size:12px; font-weight:700; color:#0284c7; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            2. RESUMO DE FATURAÇÃO & HONORÁRIOS
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:20px; page-break-inside:avoid;">
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#0284c7; font-size:18px; font-weight:800;">${formatarMoeda(totalFaturado)}</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Total Faturado</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#16a34a; font-size:18px; font-weight:800;">${formatarMoeda(totalRecebido)}</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Total Recebido</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:${totalPendente > 0 ? '#dc2626' : '#16a34a'}; font-size:18px; font-weight:800;">${formatarMoeda(totalPendente)}</div>
              <div style="color:#64748b; font-size:10px; text-transform:uppercase; font-weight:700; margin-top:2px;">Saldo Pendente</div>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:10.5px;">
            <thead>
              <tr style="background:#0284c7; color:#ffffff;">
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Data</th>
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Paciente</th>
                <th style="padding:8px 10px; text-align:left; font-size:10px;">Procedimento</th>
                <th style="padding:8px 10px; text-align:right; font-size:10px;">Total (Kz)</th>
                <th style="padding:8px 10px; text-align:right; font-size:10px;">Recebido</th>
                <th style="padding:8px 10px; text-align:right; font-size:10px;">Dívida</th>
                <th style="padding:8px 10px; text-align:center; font-size:10px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${itemsFinanceiros.slice(0, 50).map((item: any) => {
                const vTotal = Number(item.valor || 0);
                const vPago = item.status_financeiro === 'pago' ? vTotal : Number(item.valor_pago || 0);
                const divida = vTotal - vPago;
                const statusFin = item.status_financeiro || (vPago >= vTotal ? 'pago' : vPago > 0 ? 'parcial' : 'pendente');
                const dataRef = item.appointment_date || item.updated_at || item.created_at;
                const dataStr = dataRef ? new Date(dataRef).toLocaleDateString('pt-AO') : '---';
                const statusLabel = statusFin === 'pago' ? 'PAGO' : statusFin === 'parcial' ? 'PARCIAL' : 'PENDENTE';
                return `
                  <tr style="page-break-inside:avoid;">
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;">${dataStr}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; font-weight:600;">${item.paciente_nome || 'Paciente'}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0;">${item.procedimento || 'Procedimento'}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:right;">${formatarMoeda(vTotal)}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:right; color:#16a34a; font-weight:700;">${formatarMoeda(vPago)}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:right; color:${divida > 0 ? '#dc2626' : '#16a34a'}; font-weight:700;">${formatarMoeda(divida)}</td>
                    <td style="padding:7px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">
                      <span style="padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; background:${statusFin === 'pago' ? '#dcfce7' : '#fee2e2'}; color:${statusFin === 'pago' ? '#166534' : '#991b1b'};">
                        ${statusLabel}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div style="display:flex; justify-content:space-between; gap:40px; margin-top:36px; page-break-inside:avoid;">
            <div style="flex:1; text-align:center;">
              <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                Dr(a). ${profile?.nome || 'Médico Dentista'}
              </div>
              <div style="font-size:9.5px; color:#64748b;">CRM: ${profile?.crm || 'Não informado'}</div>
            </div>
            <div style="flex:1; text-align:center;">
              <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                Direcção Clínica & Auditoria
              </div>
              <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola</div>
            </div>
          </div>

          <div style="margin-top:26px; text-align:center; color:#94a3b8; font-size:9px; border-top:1px solid #e2e8f0; padding-top:8px;">
            Documento emitido electronicamente &bull; TeOdonto Angola &bull; Sistema de Gestão Integrada
          </div>
        </div>
      `;

      const result = await exportHtmlAsPdf(html, `relatorio-completo-${profile?.nome || 'dentista'}.pdf`);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      Toast.show({
        type: 'success',
        text1: '✅ Relatório gerado!',
        text2: 'PDF pronto para compartilhar'
      });
    } catch (error: any) {
      console.error('Erro PDF:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Erro ao gerar PDF',
        text2: error.message || 'Tente novamente'
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  const gerarPdfFaturacao = async () => {
    setGerandoPdf(true);
    try {
      const faturacaoRes = profile?.id ? await buscarTratamentosFinanceirosDentista(profile.id) : { success: false, data: [] };
      const itemsFinanceiros = faturacaoRes.success ? (faturacaoRes.data || []) : [];
      
      const html = buildDentistBillingHtml(profile?.nome || 'Dentista', itemsFinanceiros, profile?.nome);
      const result = await exportHtmlAsPdf(html, `faturacao-${profile?.nome || 'dentista'}.pdf`);
      if (!result.success) throw new Error(result.error);
      Toast.show({ type: 'success', text1: '✅ Facturação gerada!' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: '❌ Erro no PDF', text2: error.message });
    } finally {
      setGerandoPdf(false);
    }
  };

  const gerarFichaPaciente = async (pacienteId: string) => {
    setShowPacienteModal(false);
    setGerandoPdf(true);
    try {
      const html = await gerarFichaHistorico(pacienteId);
      
      const result = await exportHtmlAsPdf(html, `ficha-${pacienteId.substring(0, 8)}.pdf`);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      Toast.show({
        type: 'success',
        text1: '✅ Ficha gerada!',
        text2: 'PDF pronto para compartilhar'
      });
    } catch (error: any) {
      console.error('Erro ficha:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Erro ao gerar ficha',
        text2: error.message || 'Tente novamente'
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  if (loading && !error) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={styles.contentContainerStyle}
      >


        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
            <Text style={styles.errorTitle}>Erro ao carregar relatórios</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {agendamentos.length === 0 && !loading && !error && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>Nenhuma consulta encontrada</Text>
            <Text style={styles.emptyText}>Faça seu primeiro agendamento para gerar relatórios</Text>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{agendamentos.length}</Text>
            <Text style={styles.statLabel}>Total Consultas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pacientesList.length}</Text>
            <Text style={styles.statLabel}>Pacientes Únicos</Text>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity 
            style={[styles.card, styles.cardElevated]}
            onPress={gerarPdfFaturacao}
            activeOpacity={0.8}
            disabled={gerandoPdf}
          >
            <View style={[styles.cardIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="cash-outline" size={32} color="#10B981" />
            </View>
            <Text style={styles.cardTitle}>Relatório de Faturação</Text>
            <Text style={styles.cardDescription}>Valores faturados, recebidos e pendentes da operação</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cardFooterText}>Gestão Financeira</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, styles.cardElevated]}
            onPress={() => setShowPacienteModal(true)}
            activeOpacity={0.8}
            disabled={gerandoPdf}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="document-attach-outline" size={32} color="#9C27B0" />
            </View>
            <Text style={styles.cardTitle}>Documentos em PDF</Text>
            <Text style={styles.cardDescription}>Gerar ficha completa e historico clinico do paciente em PDF</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cardFooterText}>{pacientesList.length} pacientes disponíveis</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, styles.cardElevated, { marginTop: Platform.OS === 'web' ? 0 : SIZES.lg }]}
            onPress={gerarPdfAgendamentos}
            activeOpacity={0.8}
            disabled={gerandoPdf}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>Relatório Completo</Text>
            <Text style={styles.cardDescription}>Resumo detalhado das consultas e indicadores do dentista</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cardFooterText}>{agendamentos.length} registros</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {gerandoPdf && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.generatingText}>Gerando PDF profissional...</Text>
            <Text style={styles.generatingSubtext}>Aguarde alguns segundos</Text>
          </View>
        </View>
      )}

      <Modal visible={showPacienteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Paciente</Text>
              <TouchableOpacity onPress={() => setShowPacienteModal(false)}>
                <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pacientesList} showsVerticalScrollIndicator={false}>
              {(() => {
                const hoje = new Date();
                hoje.setHours(0,0,0,0);
                const inicioSemana = new Date(hoje);
                inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                const inicioAno = new Date(hoje.getFullYear(), 0, 1);

                const grupos: Record<string, typeof pacientesList> = {
                  'Hoje': [],
                  'Esta Semana': [],
                  'Este Mês': [],
                  'Este Ano': [],
                  'Anteriores': []
                };

                pacientesList.forEach(p => {
                  const d = new Date(p.created_at || Date.now());
                  if (d >= hoje) grupos['Hoje'].push(p);
                  else if (d >= inicioSemana) grupos['Esta Semana'].push(p);
                  else if (d >= inicioMes) grupos['Este Mês'].push(p);
                  else if (d >= inicioAno) grupos['Este Ano'].push(p);
                  else grupos['Anteriores'].push(p);
                });

                return Object.entries(grupos).map(([titulo, lista]) => {
                  if (lista.length === 0) return null;
                  return (
                    <View key={titulo}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16, marginBottom: 8, paddingHorizontal: 4, textTransform: 'uppercase' }}>
                        {titulo}
                      </Text>
                      {lista.map(item => (
                        <TouchableOpacity 
                          key={item.id}
                          style={styles.pacienteItem}
                          onPress={() => gerarFichaPaciente(item.id)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pacienteNome}>{item.nome}</Text>
                            {(!!item.data_nascimento || !!item.genero) && (
                              <View style={styles.pacienteDetails}>
                                {!!item.data_nascimento && (
                                  <View style={styles.detailItem}>
                                    <Ionicons name="calendar-outline" size={10} color={COLORS.textSecondary} />
                                    <Text style={styles.detailText}>DT: {item.data_nascimento}</Text>
                                  </View>
                                )}
                                {!!item.genero && (
                                  <View style={styles.detailItem}>
                                    <Ionicons name="person-outline" size={10} color={COLORS.textSecondary} />
                                    <Text style={styles.detailText}>S: {item.genero}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                });
              })()}
            </ScrollView>
            {pacientesList.length === 0 && (
              <View style={styles.emptyModal}>
            <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyModalText}>Nenhum paciente atribuído ao dentista</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainerStyle: {
    paddingBottom: SIZES.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
    paddingVertical: SIZES.lg,
  },
  headerTitle: {
    fontSize: SIZES.fontXxl,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SIZES.sm,
  },
  headerSubtitle: {
    fontSize: SIZES.fontLg,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
    paddingHorizontal: SIZES.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: SIZES.xl,
    paddingHorizontal: SIZES.md,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    minWidth: 120,
    ...SHADOWS.md,
  },
  statNumber: {
    fontSize: SIZES.fontXxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  cardsContainer: {
    paddingHorizontal: SIZES.md,
    gap: SIZES.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    width: Platform.OS === 'web' ? '48.5%' : '100%',
    ...SHADOWS.md,
  },
  cardElevated: {
    ...SHADOWS.lg,
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  cardTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  cardDescription: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SIZES.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: SIZES.sm,
  },
  cardFooterText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.lg,
    marginBottom: SIZES.sm,
  },
  emptyText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SIZES.lg,
  },
  errorContainer: {
    backgroundColor: COLORS.surface,
    margin: SIZES.lg,
    padding: SIZES.xl,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  errorTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.danger,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  errorText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.lg,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  retryButtonText: {
    color: 'white',
    fontSize: SIZES.fontMd,
    fontWeight: '600',
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  generatingContent: {
    backgroundColor: 'white',
    padding: SIZES.xl,
    borderRadius: 36,
    alignItems: 'center',
    gap: SIZES.lg,
    minWidth: 280,
  },
  generatingText: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  generatingSubtext: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 36,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  pacientesList: {
    maxHeight: 400,
    paddingHorizontal: SIZES.sm,
  },
  pacienteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  pacienteNome: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '600',
  },
  pacienteDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emptyModal: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
  },
  emptyModalText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
});

export default DentistaRelatorioScreen;
