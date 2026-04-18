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
import { buscarTratamentosFinanceirosDentista } from '../../services/relatorioService';

interface PacienteListItem {
  id: string;
  nome: string;
  data_nascimento?: string;
  genero?: string;
  created_at?: string;
}

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
        const list = (pacResult.data || []).map(p => ({
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

      // Buscar dados de faturação
      const faturacaoRes = await buscarTratamentosFinanceirosDentista(profile?.id);
      const itemsFinanceiros = faturacaoRes.success ? (faturacaoRes.data || []) : [];
      
      // Calcular totais de faturação
      let totalFaturado = 0;
      let totalRecebido = 0;
      itemsFinanceiros.forEach((item: any) => {
        const valor = Number(item.valor || 0);
        const valorPago = Number(item.valor_pago || 0);
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
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório Completo - Dr(a). ${profile?.nome || 'Dentista'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; background: white; }
            h1 { color: #1E88E5; text-align: center; font-size: 24px; margin-bottom: 30px; }
            h2 { color: #1E88E5; font-size: 16px; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #1E88E5; padding-bottom: 8px; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .info p { margin: 5px 0; font-size: 13px; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #1E88E5; }
            .stat-number { font-size: 22px; font-weight: bold; color: #1E88E5; }
            .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
            
            /* Relatório de Faturação */
            .billing-section { margin-top: 30px; page-break-inside: avoid; }
            .billing-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
            .billing-card { padding: 15px; border-radius: 8px; text-align: center; color: white; font-weight: bold; }
            .billing-total { background: #4CAF50; }
            .billing-recebido { background: #2196F3; }
            .billing-pendente { background: #FF9800; }
            .billing-value { font-size: 20px; margin-bottom: 5px; }
            .billing-label { font-size: 12px; opacity: 0.9; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #1E88E5; color: white; font-weight: bold; }
            tr:nth-child(even) { background: #f9f9f9; }
            .status { padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
            .status.pago { background: #c8e6c9; color: #1b5e20; }
            .status.parcial { background: #fff9c4; color: #f57f17; }
            .status.pendente { background: #ffcdd2; color: #b71c1c; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .currency { font-family: 'Courier New', monospace; }
            
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #999; }
            @media print { body { margin: 0; padding: 10px; } h2 { page-break-after: avoid; } }
          </style>
        </head>
        <body>
          <h1>🦷 Sorriso Digital - Relatório Completo do Dentista</h1>
          
          <!-- Seção de Informações do Dentista -->
          <div class="info">
            <p><strong>Dentista:</strong> ${profile?.nome || 'N/D'}</p>
            <p><strong>CRM:</strong> ${profile?.crm || 'N/D'}</p>
            <p><strong>Especialidade:</strong> ${profile?.especialidade || 'N/D'}</p>
            <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-AO')}</p>
          </div>

          <!-- Seção 1: Estatísticas de Consultas -->
          <h2>📋 Estatísticas de Consultas</h2>
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${totalConsultas}</div>
              <div class="stat-label">Total de Consultas</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${consultasMes}</div>
              <div class="stat-label">Consultas Este Mês</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${agendamentos.length > 0 ? Math.round((consultasMes / totalConsultas) * 100) : 0}%</div>
              <div class="stat-label">% Este Mês</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Data/Hora</th>
                <th>Status</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${agendamentos.slice(0, 50).map((ag: any) => `
                <tr>
                  <td>${ag.paciente?.nome || 'N/D'}</td>
                  <td>${new Date(ag.data_agendamento).toLocaleString('pt-AO')}</td>
                  <td class="text-center">${ag.status || 'Pendente'}</td>
                  <td>${ag.tipo || 'Consulta'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${agendamentos.length > 50 ? '<p style="text-align:center; font-style:italic; color:#666; margin-top: 10px;">... e mais ' + (agendamentos.length - 50) + ' registros</p>' : ''}

          <!-- Seção 2: Relatório de Faturação -->
          <div class="billing-section">
            <h2>💰 Relatório de Faturação</h2>
            
            <div class="billing-summary">
              <div class="billing-card billing-total">
                <div class="billing-value currency">${formatarMoeda(totalFaturado)}</div>
                <div class="billing-label">Total Faturado</div>
              </div>
              <div class="billing-card billing-recebido">
                <div class="billing-value currency">${formatarMoeda(totalRecebido)}</div>
                <div class="billing-label">Total Recebido</div>
              </div>
              <div class="billing-card billing-pendente">
                <div class="billing-value currency">${formatarMoeda(totalPendente)}</div>
                <div class="billing-label">Pendente</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Procedimento</th>
                  <th class="text-right">Valor Total</th>
                  <th class="text-right">Valor Pago</th>
                  <th class="text-right">Dívida</th>
                  <th class="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemsFinanceiros.slice(0, 100).map((item: any) => {
                  const vTotal = Number(item.valor || 0);
                  const vPago = Number(item.valor_pago || 0);
                  const divida = vTotal - vPago;
                  const statusFin = item.status_financeiro || (vPago >= vTotal ? 'pago' : vPago > 0 ? 'parcial' : 'pendente');
                  const dataRef = item.appointment_date || item.updated_at || item.created_at;
                  const dataStr = dataRef
                    ? (typeof dataRef === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(dataRef) 
                        ? dataRef.split('-').reverse().join('/') 
                        : new Date(dataRef).toLocaleDateString('pt-AO'))
                    : '---';
                  const nomeProcedimento = item.procedimento || item.descricao || 'Procedimento';
                  const statusLabel = statusFin === 'pago' ? 'PAGO' : statusFin === 'parcial' ? 'PARCIAL' : 'PENDENTE';
                  const statusClass = statusFin === 'pago' ? 'pago' : statusFin === 'parcial' ? 'parcial' : 'pendente';
                  
                  return `
                    <tr>
                      <td>${dataStr}</td>
                      <td>${item.paciente_nome || 'Paciente'}</td>
                      <td>${nomeProcedimento}</td>
                      <td class="text-right currency">${formatarMoeda(vTotal)}</td>
                      <td class="text-right currency" style="color:#16a34a;font-weight:bold">${formatarMoeda(vPago)}</td>
                      <td class="text-right currency" style="color:${divida > 0 ? '#b91c1c' : '#16a34a'}">${formatarMoeda(divida)}</td>
                      <td class="text-center"><span class="status ${statusClass}">${statusLabel}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            ${itemsFinanceiros.length > 100 ? '<p style="text-align:center; font-style:italic; color:#666; margin-top: 10px;">... e mais ' + (itemsFinanceiros.length - 100) + ' registros</p>' : ''}
            ${itemsFinanceiros.length === 0 ? '<p style="text-align:center; color:#999; margin-top: 10px;">Nenhum procedimento registrado</p>' : ''}
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Sorriso Digital - Sistema de Gestão Odontológica</p>
            <p>Documento gerado automaticamente pelo sistema</p>
          </div>
        </body>
        </html>`;

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
      const faturacaoRes = await buscarTratamentosFinanceirosDentista(profile?.id);
      const itemsFinanceiros = faturacaoRes.success ? (faturacaoRes.data || []) : [];
      
      let totalFaturado = 0;
      let totalRecebido = 0;
      itemsFinanceiros.forEach((item: any) => {
        const valor = Number(item.valor || 0);
        const valorPago = Number(item.valor_pago || 0);
        totalFaturado += valor;
        totalRecebido += valorPago;
      });
      const totalPendente = totalFaturado - totalRecebido;

      const formatarMoeda = (valor: number): string => {
        return new Intl.NumberFormat('pt-AO', {
          style: 'currency',
          currency: 'AOA',
          minimumFractionDigits: 0,
        }).format(valor);
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Facturação - Dr(a). ${profile?.nome || 'Dentista'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; background: white; }
            h1 { color: #10B981; text-align: center; font-size: 24px; margin-bottom: 20px; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 13px; }
            
            .billing-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
            .billing-card { padding: 15px; border-radius: 8px; text-align: center; color: white; font-weight: bold; }
            .billing-total { background: #4CAF50; }
            .billing-recebido { background: #10B981; }
            .billing-pendente { background: #FF9800; }
            .billing-value { font-size: 20px; margin-bottom: 5px; }
            .billing-label { font-size: 12px; opacity: 0.9; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #10B981; color: white; font-weight: bold; }
            tr:nth-child(even) { background: #f9f9f9; }
            .status { padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
            .status.pago { background: #D1FAE5; color: #065F46; }
            .status.parcial { background: #FEF3C7; color: #92400E; }
            .status.pendente { background: #FEE2E2; color: #991B1B; }
            .text-right { text-align: right; }
            .currency { font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>💰 Relatório de Faturação</h1>
          <div class="info">
            <p><strong>Médico(a):</strong> ${profile?.nome || 'N/D'}</p>
            <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-AO')}</p>
          </div>

          <div class="billing-summary">
            <div class="billing-card billing-total">
              <div class="billing-value currency">${formatarMoeda(totalFaturado)}</div>
              <div class="billing-label">Total Faturado</div>
            </div>
            <div class="billing-card billing-recebido">
              <div class="billing-value currency">${formatarMoeda(totalRecebido)}</div>
              <div class="billing-label">Total Recebido</div>
            </div>
            <div class="billing-card billing-pendente">
              <div class="billing-value currency">${formatarMoeda(totalPendente)}</div>
              <div class="billing-label">Pendente</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Paciente</th>
                <th>Procedimento</th>
                <th class="text-right">Total</th>
                <th class="text-right">Pago</th>
                <th class="text-right">Dívida</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${itemsFinanceiros.length === 0 ? '<tr><td colspan="7" style="text-align:center">Sem registos financeiros encontrados</td></tr>' : itemsFinanceiros.map((item: any) => {
                const vTotal = Number(item.valor || 0);
                const vPago = Number(item.valor_pago || 0);
                const divida = vTotal - vPago;
                const statusFin = item.status_financeiro || (vPago >= vTotal ? 'pago' : vPago > 0 ? 'parcial' : 'pendente');
                const dataRef = item.appointment_date || item.updated_at || item.created_at;
                const dataStr = dataRef ? new Date(dataRef).toLocaleDateString('pt-AO') : '---';
                const statusLabel = statusFin === 'pago' ? 'PAGO' : statusFin === 'parcial' ? 'PARCIAL' : 'PENDENTE';
                return `
                  <tr>
                    <td>${dataStr}</td>
                    <td>${item.paciente_nome || 'Paciente'}</td>
                    <td>${item.procedimento || 'Procedimento'}</td>
                    <td class="text-right currency">${formatarMoeda(vTotal)}</td>
                    <td class="text-right currency" style="color:#059669">${formatarMoeda(vPago)}</td>
                    <td class="text-right currency" style="color:${divida > 0 ? '#DC2626' : '#059669'}">${formatarMoeda(divida)}</td>
                    <td><span class="status ${statusFin}">${statusLabel}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
        </html>`;

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
                <Text style={styles.emptyModalText}>Nenhum paciente nos agendamentos</Text>
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
