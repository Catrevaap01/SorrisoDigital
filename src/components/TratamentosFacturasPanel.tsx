import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
import {
  atualizarFinanceiroProcedimento,
  TratamentoFinanceiroItem,
} from '../services/secretarioService';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { formatDateTime } from '../utils/helpers';

const formatCurrency = (value: number | string | undefined) => {
  const amount = Number(value || 0);
  if (isNaN(amount)) return '0 Kz';
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

type Props = {
  items: TratamentoFinanceiroItem[];
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
};

type FiltroFinanceiro = 'todos' | 'aguardando_factura' | 'pendente' | 'pago' | 'parcial';

type GrupoFacturaUnificada = {
  paciente_id?: string;
  paciente_nome: string;
  paciente_telefone?: string;
  items: TratamentoFinanceiroItem[];
  dentistas: string[];
  total: number;
};

type HistoricoFinanceiroAgrupado = {
  id: string;
  paciente_nome: string;
  numero_factura?: string | null;
  data_referencia: string;
  total: number;
  quantidade_servicos: number;
  procedimentos: string[];
};

const FILTROS: Array<{ key: FiltroFinanceiro; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'aguardando_factura', label: 'Aguardando factura' },
  { key: 'pendente', label: 'Pendente' },
  { key: 'parcial', label: 'Parcial' },
  { key: 'pago', label: 'Pago' },
];

const money = (value: number) => `${Number(value || 0).toLocaleString('pt-AO')} Kz`;

const clinicalStatus = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'concluido') return { label: 'Concluido', bg: '#DCFCE7', text: '#166534' };
  if (value === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', text: '#B91C1C' };
  return { label: 'Em execucao', bg: '#DBEAFE', text: '#1D4ED8' };
};

const financialStatus = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'aguardando_factura') return { label: 'Aguardando factura', bg: '#FEE2E2', text: '#DC2626' };
  if (value === 'pendente') return { label: 'Pendente', bg: '#FEE2E2', text: '#DC2626' };
  if (value === 'parcial') return { label: 'Parcial', bg: '#FEF3C7', text: '#92400E' };
  if (value === 'pago') return { label: 'Pago', bg: '#DCFCE7', text: '#166534' };
  return { label: 'Sem factura', bg: '#E5E7EB', text: '#475569' };
};

const buildHtml = (item: TratamentoFinanceiroItem, numero?: string) => `
  <div style="max-width:800px; margin:0 auto; padding:40px; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <div style="text-align:center; margin-bottom:40px; border-bottom:2px solid #f1f5f9; padding-bottom:20px;">
      <h1 style="margin:0; color:#1e293b; font-size:28px; font-weight:700;">SORRISO DIGITAL CLÍNICA DENTÁRIA</h1>
      <p style="margin:8px 0 0 0; color:#64748b; font-size:14px;">Relatório de Serviço Individual</p>
    </div>
    <div style="margin-bottom:30px;">
      <h2 style="margin:0 0 15px 0; color:#1e293b; font-size:18px; font-weight:600; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Dados do Paciente</h2>
      <p style="margin:6px 0; color:#475569;"><strong>Nome:</strong> ${item.paciente_nome}</p>
    </div>
    
    <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
      <thead>
        <tr style="background-color:#f8fafc;">
          <th style="text-align:left; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">TRATAMENTO REALIZADO</th>
          <th style="text-align:right; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">VALOR PAGO</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9;">
            <div style="font-weight:bold; color:#1e293b;">${item.procedimento}</div>
          </td>
          <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:bold;">${money(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))}</td>
        </tr>
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end;">
      <div style="width:300px;">
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Valor Pago</span>
          <span style="font-weight:500;">${money(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))}</span>
        </div>
        ${Number(item.valor || 0) - Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0)) > 0 ? `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Dívida Pendente</span>
          <span style="font-weight:500; color:#DC2626;">${money(Number(item.valor || 0) - Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0)))}</span>
        </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; padding:15px 0;">
          <span style="font-weight:bold; color:#1e293b; font-size:18px;">VALOR TOTAL DA CONSULTA</span>
          <span style="font-weight:bold; color:#7C3AED; font-size:18px;">${money(item.valor)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:60px; padding-top:20px; border-top:1px solid #f1f5f9; text-align:center; color:#94a3b8; font-size:12px;">
      <p>Obrigado por confiar no Sorriso Digital. Este documento serve como comprovativo de serviço.</p>
      <p>Emitido em ${formatDateTime(new Date().toISOString())}</p>
    </div>
  </div>
`;

const buildUnifiedHtml = (grupo: GrupoFacturaUnificada, numero?: string) => `
  <div style="max-width:800px; margin:0 auto; padding:40px; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom: 2px solid #efeff1; padding-bottom: 20px;">
      <div style="flex:1;">
        <h1 style="color:#7C3AED; margin:0; font-size:28px; letter-spacing:-1px;">SORRISO DIGITAL</h1>
        <p style="margin:5px 0; font-size:14px; color:#64748b;">Clínica Odontológica de Excelência</p>
        <p style="margin:5px 0; font-size:12px; color:#94a3b8;">Av. Deolinda Rodrigues, Luanda, Angola</p>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0; color:#1e293b; font-size:18px;">FACTURA UNIFICADA</h2>
        <p style="margin:5px 0; font-weight:bold; color:#7C3AED;"># ${numero || 'UNIFICADO'}</p>
        <p style="margin:5px 0; font-size:13px;">Data: ${formatDateTime(new Date().toISOString())}</p>
      </div>
    </div>

    <div style="margin-bottom:40px;">
      <h3 style="font-size:12px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px; border-bottom:1px solid #f1f5f9;">Dados do Paciente</h3>
      <p style="margin:4px 0; font-weight:bold; color:#1e293b; font-size:16px;">${grupo.paciente_nome}</p>
      <p style="margin:4px 0; font-size:13px;">${grupo.paciente_telefone || 'Telefone não informado'}</p>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
      <thead>
        <tr style="background-color:#f8fafc;">
          <th style="text-align:left; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">TRATAMENTO REALIZADO</th>
          <th style="text-align:right; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">VALOR PAGO</th>
        </tr>
      </thead>
      <tbody>
        ${grupo.items.map((item) => `
          <tr>
            <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9;">
              <div style="font-weight:bold; color:#1e293b;">${item.procedimento}</div>
            </td>
            <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:bold;">${money(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end;">
      <div style="width:300px;">
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Valor Pago dos Serviços (${grupo.items.length})</span>
          <span style="font-weight:500;">${money(grupo.items.reduce((sum, item) => sum + Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0)), 0))}</span>
        </div>
        ${grupo.items.reduce((sum, item) => sum + (Number(item.valor || 0) - Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))), 0) > 0 ? `
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Dívida Pendente Consolidada</span>
          <span style="font-weight:500; color:#DC2626;">${money(grupo.items.reduce((sum, item) => sum + (Number(item.valor || 0) - Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))), 0))}</span>
        </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; padding:15px 0;">
          <span style="font-weight:bold; color:#1e293b; font-size:18px;">VALOR TOTAL (BRUTO)</span>
          <span style="font-weight:bold; color:#7C3AED; font-size:18px;">${money(grupo.total)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:60px; padding-top:20px; border-top:1px solid #f1f5f9; text-align:center; color:#94a3b8; font-size:12px;">
      <p>Obrigado por escolher o Sorriso Digital. Este é um resumo consolidado de seus tratamentos.</p>
      <p>Emitido em ${formatDateTime(new Date().toISOString())}</p>
    </div>
  </div>
`;

const TratamentosFacturasPanel: React.FC<Props> = ({ items, loading, onRefresh }) => {
  const [filtro, setFiltro] = useState<FiltroFinanceiro>('todos');
  const [selected, setSelected] = useState<TratamentoFinanceiroItem | null>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoFacturaUnificada | null>(null);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [modalPagamentoParcial, setModalPagamentoParcial] = useState(false);
  const [valorPagamentoParcial, setValorPagamentoParcial] = useState('');
  const [itemPagamentoParcial, setItemPagamentoParcial] = useState<TratamentoFinanceiroItem | null>(null);

  const resumo = useMemo(() => {
    const today = new Date().toDateString();
    const itemsFiltered = items;
    
    // Helper for payment calculation
    const getPago = (p: any) => Number(p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : (p.status_financeiro === 'pago' ? (p.valor || 0) : 0));

    // Calculate today's revenue (only paid amounts)
    const receitaHoje = itemsFiltered
      .filter(item => {
        const dStr = (item.pago_em || item.factura_emitida_em || item.updated_at);
        return dStr && new Date(dStr).toDateString() === today && getPago(item) > 0;
      })
      .reduce((sum, item) => sum + getPago(item), 0);
    
    // Calculate week's revenue (only paid amounts)
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setHours(0,0,0,0);
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
    const receitaSemana = itemsFiltered
      .filter(item => {
        const dStr = (item.pago_em || item.factura_emitida_em || item.updated_at);
        if (!dStr) return false;
        const dataPay = new Date(dStr);
        return dataPay >= umaSemanaAtras && getPago(item) > 0;
      })
      .reduce((sum, item) => sum + getPago(item), 0);
    
    // Count patients attended today
    const pacientesAtendidosHoje = new Set(
      itemsFiltered
        .filter(item => item.factura_emitida_em && new Date(item.factura_emitida_em).toDateString() === today)
        .map(item => item.paciente_id)
    ).size;
    
    // Calculate attendance rate
    const totalPacientesDia = new Set(itemsFiltered.filter(item => item.factura_emitida_em).map(item => item.paciente_id)).size;
    const taxaFalta = totalPacientesDia > 0 ? ((totalPacientesDia - pacientesAtendidosHoje) / totalPacientesDia) * 100 : 0;
    
    return {
      planosAtivos: new Set(itemsFiltered.filter((item) => item.status_clinico !== 'cancelado').map((item) => item.plano_id)).size,
      aguardando: itemsFiltered.filter((item) => item.status_financeiro === 'aguardando_factura').length,
      facturasHoje: itemsFiltered.filter((item) => item.factura_emitida_em && new Date(item.factura_emitida_em).toDateString() === today).length,
      pendentes: itemsFiltered.filter((item) => ['aguardando_factura', 'pendente', 'parcial'].includes(item.status_financeiro)).length,
      receitaHoje,
      receitaSemana,
      pacientesAtendidosHoje,
      taxaFalta,
    };
  }, [items]);

  const filtered = useMemo(() => (
    filtro === 'todos' ? items : items.filter((item) => item.status_financeiro === filtro)
  ), [filtro, items]);

  const historico = useMemo<HistoricoFinanceiroAgrupado[]>(() => {
    const grupos = new Map<string, HistoricoFinanceiroAgrupado>();

    items
      .filter((item) => item.numero_factura || item.pago_em)
      .forEach((item) => {
        const chave = item.numero_factura ? `factura:${item.numero_factura}` : `item:${item.id}`;
        const dataReferencia = item.factura_emitida_em || item.pago_em || item.data_hora;
        const existente = grupos.get(chave);

        if (existente) {
          existente.total += Number(item.valor_pago || 0);
          existente.quantidade_servicos += 1;
          if (item.procedimento && !existente.procedimentos.includes(item.procedimento)) {
            existente.procedimentos.push(item.procedimento);
          }
          if (new Date(dataReferencia).getTime() > new Date(existente.data_referencia).getTime()) {
            existente.data_referencia = dataReferencia;
          }
          return;
        }

        grupos.set(chave, {
          id: chave,
          paciente_nome: item.paciente_nome,
          numero_factura: item.numero_factura || null,
          data_referencia: dataReferencia,
          total: Number(item.valor_pago || 0),
          quantidade_servicos: 1,
          procedimentos: item.procedimento ? [item.procedimento] : [],
        });
      });

    return Array.from(grupos.values())
      .sort((a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime())
      .slice(0, 8);
  }, [items]);

  const gruposUnificaveis = useMemo(() => {
    const grupos = new Map<string, GrupoFacturaUnificada>();

    items.forEach((item) => {
      const chave = item.paciente_id || item.paciente_nome;
      const existente = grupos.get(chave);

      if (existente) {
        existente.items.push(item);
        existente.total += Number(item.valor || 0);
        if (item.dentista_nome && !existente.dentistas.includes(item.dentista_nome)) {
          existente.dentistas.push(item.dentista_nome);
        }
        return;
      }

      grupos.set(chave, {
        paciente_id: item.paciente_id,
        paciente_nome: item.paciente_nome,
        paciente_telefone: item.paciente_telefone,
        items: [item],
        dentistas: item.dentista_nome ? [item.dentista_nome] : [],
        total: Number(item.valor || 0),
      });
    });

    return Array.from(grupos.values())
      .filter((grupo) => grupo.items.length > 1 && grupo.dentistas.length > 1)
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const emitirFactura = async (status: 'pendente' | 'parcial' | 'pago') => {
    if (!selected) return;
    const result = await atualizarFinanceiroProcedimento(selected.id, {
      numero_factura: numeroFactura.trim() || `FT-${Date.now().toString().slice(-6)}`,
      status_financeiro: status,
      factura_emitida_em: new Date().toISOString(),
      pago_em: status === 'pago' ? new Date().toISOString() : null,
    });
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao emitir factura', text2: result.error || 'Tente novamente' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Factura atualizada' });
    setSelected(null);
    setNumeroFactura('');
    onRefresh();
  };

  const unificarFacturas = async (status: 'pendente' | 'parcial' | 'pago') => {
    if (!grupoSelecionado) return;

    const numero = numeroFactura.trim() || `FT-${Date.now().toString().slice(-6)}`;
    const agora = new Date().toISOString();

    for (const item of grupoSelecionado.items) {
      const result = await atualizarFinanceiroProcedimento(item.id, {
        numero_factura: numero,
        status_financeiro: status,
        factura_emitida_em: agora,
        pago_em: status === 'pago' ? agora : null,
      });

      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Erro ao unificar facturas', text2: result.error || 'Tente novamente' });
        return;
      }
    }

    Toast.show({
      type: 'success',
      text1: 'Factura unificada emitida',
      text2: `${grupoSelecionado.paciente_nome} • ${money(grupoSelecionado.total)}`,
    });
    setGrupoSelecionado(null);
    setNumeroFactura('');
    onRefresh();
  };

  const marcarPago = async (item: TratamentoFinanceiroItem) => {
    const result = await atualizarFinanceiroProcedimento(item.id, {
      status_financeiro: 'pago',
      pago_em: new Date().toISOString(),
      factura_emitida_em: item.factura_emitida_em || new Date().toISOString(),
      numero_factura: item.numero_factura || `FT-${Date.now().toString().slice(-6)}`,
    });
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Pagamento marcado como pago' });
      onRefresh();
    }
  };

  const processarPagamentoParcial = async () => {
    if (!itemPagamentoParcial || !valorPagamentoParcial) {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Preencha o valor do pagamento' });
      return;
    }

    const valor = Number(valorPagamentoParcial);
    const valorTotal = Number(itemPagamentoParcial.valor || 0);
    const valorPagoAtual = Number(itemPagamentoParcial.valor_pago || 0);
    const novoValorPago = valorPagoAtual + valor;

    if (valor <= 0 || valor > valorTotal) {
      Toast.show({ type: 'error', text1: 'Erro', text2: 'Valor de pagamento inválido' });
      return;
    }

    const status = novoValorPago >= valorTotal ? 'pago' : 'parcial';
    
    const result = await atualizarFinanceiroProcedimento(itemPagamentoParcial.id, {
      status_financeiro: status,
      valor_pago: novoValorPago,
      pago_em: status === 'pago' ? new Date().toISOString() : (itemPagamentoParcial.pago_em || new Date().toISOString()),
      factura_emitida_em: itemPagamentoParcial.factura_emitida_em || new Date().toISOString(),
      numero_factura: itemPagamentoParcial.numero_factura || `FT-${Date.now().toString().slice(-6)}`,
    });

    if (result.success) {
      Toast.show({ type: 'success', text1: 'Pagamento parcial processado' });
      setModalPagamentoParcial(false);
      setValorPagamentoParcial('');
      setItemPagamentoParcial(null);
      onRefresh();
    } else {
      Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Tente novamente' });
    }
  };

  const abrirModalPagamentoParcial = (item: TratamentoFinanceiroItem) => {
    setItemPagamentoParcial(item);
    setValorPagamentoParcial('');
    setModalPagamentoParcial(true);
  };

  const emitirFacturaPagamento = async (item: TratamentoFinanceiroItem) => {
    const html = buildHtml(item);
    const result = await exportHtmlAsPdf(html, `factura-pagamento-${item.id}.pdf`);
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Factura de pagamento emitida' });
    } else {
      Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Tente novamente' });
    }
  };

  const enviarWhatsapp = async (item: TratamentoFinanceiroItem) => {
    if (!item.paciente_telefone) return Toast.show({ type: 'info', text1: 'Paciente sem telefone' });
    const phone = item.paciente_telefone.replace(/\D/g, '');
    await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá ${item.paciente_nome}, procedimento ${item.procedimento} no valor de ${money(item.valor)}.`)}`);
  };

  const handlePrintServico = async (item: TratamentoFinanceiroItem) => {
    const result = await exportHtmlAsPdf(buildHtml(item), `factura-servico-${item.id}.pdf`);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao imprimir serviço', text2: result.error || 'Tente novamente' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Impressão iniciada', text2: 'Serviço pronto para impressão.' });
  };

  const handlePrintFacturaUnica = async (grupo: GrupoFacturaUnificada) => {
    const numero = grupo.items.find((item) => item.numero_factura)?.numero_factura;
    const result = await exportHtmlAsPdf(buildUnifiedHtml(grupo, numero || undefined), `factura-unica-${grupo.paciente_id || grupo.paciente_nome}.pdf`);
    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao imprimir factura única', text2: result.error || 'Tente novamente' });
      return;
    }
    Toast.show({ type: 'success', text1: 'Impressão iniciada', text2: 'Factura única pronta para impressão.' });
  };

  return (
    <>
      <View style={styles.content}>
          <View>
            <View style={styles.metricsContainer}>
              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="document-text-outline" size={16} color="#DC2626" />
                  </View>
                  <Text style={styles.metricValue}>{resumo.aguardando}</Text>
                  <Text style={styles.metricLabel}>Aguardando Factura</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="cash-outline" size={16} color="#059669" />
                  </View>
                  <Text style={styles.metricValue}>{formatCurrency(resumo.receitaHoje)}</Text>
                  <Text style={styles.metricLabel}>Receita Hoje</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="cash-outline" size={16} color="#059669" />
                  </View>
                  <Text style={styles.metricValue}>{formatCurrency(resumo.receitaSemana)}</Text>
                  <Text style={styles.metricLabel}>Receita Semana</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="people-outline" size={16} color="#7C3AED" />
                  </View>
                  <Text style={styles.metricValue}>{resumo.pacientesAtendidosHoje}</Text>
                  <Text style={styles.metricLabel}>Pacientes Hoje</Text>
                </View>
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                  </View>
                  <Text style={styles.metricValue}>{resumo.taxaFalta.toFixed(1)}%</Text>
                  <Text style={styles.metricLabel}>Taxa Falta</Text>
                </View>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {FILTROS.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.filterChip, filtro === item.key && styles.filterChipActive]} onPress={() => setFiltro(item.key)}>
                  <Text style={[styles.filterText, filtro === item.key && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {gruposUnificaveis.length > 0 && (
              <View style={styles.unifiedCard}>
                <Text style={styles.unifiedTitle}>Facturas unificadas por paciente</Text>
                <Text style={styles.unifiedSubtitle}>Pacientes atendidos por dois ou mais dentistas podem receber uma unica factura com o valor total somado.</Text>
                {gruposUnificaveis.map((grupo) => (
                  <View key={grupo.paciente_id || grupo.paciente_nome} style={styles.unifiedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unifiedPatient}>{grupo.paciente_nome}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.dentistas.join(' • ')}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.items.length} servicos • {money(grupo.total)}</Text>
                    </View>
                    <TouchableOpacity style={styles.unifyBtn} onPress={() => { setNumeroFactura(''); setGrupoSelecionado(grupo); }}>
                      <Text style={styles.unifyBtnText}>Unificar facturas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.printBtn} onPress={() => void handlePrintFacturaUnica(grupo)}>
                      <Text style={styles.printBtnText}>Imprimir factura única</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {(() => {
            const listData = filtro === 'pago' ? [] : filtered;
            if (listData.length === 0) {
              return filtro === 'pago' ? null : <View style={styles.footerCard}><Text style={styles.empty}>Nenhum procedimento encontrado.</Text></View>;
            }
            return listData.map((item) => {
              const clinical = clinicalStatus(item.status_clinico);
              const financial = financialStatus(item.status_financeiro);
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.patient}>{item.paciente_nome}</Text>
                      <Text style={styles.meta}>Dr(a). {item.dentista_nome} • {item.especialidade}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.procedure}>{item.procedimento}</Text>
                  <Text style={styles.meta}>{formatDateTime(item.data_hora)}</Text>
                  
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentText}>Valor Já Pago: {money(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0))}</Text>
                    <Text style={[styles.paymentText, { color: COLORS.danger }]}>
                      Saldo Devedor: {money(Number(item.valor || 0) - Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0)))}
                    </Text>
                  </View>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusChip, { backgroundColor: clinical.bg }]}><Text style={[styles.statusText, { color: clinical.text }]}>Clinico: {clinical.label}</Text></View>
                    <View style={[styles.statusChip, { backgroundColor: financial.bg }]}><Text style={[styles.statusText, { color: financial.text }]}>Financeiro: {financial.label}</Text></View>
                  </View>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setNumeroFactura(''); setSelected(item); }}><Text style={styles.actionText}>Emitir factura</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalPagamentoParcial(item)}><Text style={styles.actionText}>Pagamento Parcial</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => emitirFacturaPagamento(item)}><Text style={styles.actionText}>Fatura pago</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => void handlePrintServico(item)}><Text style={styles.actionText}>Imprimir serviço</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => void marcarPago(item)}><Text style={styles.actionText}>Marcar pago</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => void enviarWhatsapp(item)}><Text style={styles.actionText}>WhatsApp</Text></TouchableOpacity>
                  </View>
                </View>
              );
            });
          })()}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Historico financeiro</Text>
            {historico.length === 0 ? <Text style={styles.empty}>Sem historico financeiro.</Text> : historico.map((item) => (
              <View key={`h-${item.id}`} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {item.paciente_nome} • {item.quantidade_servicos > 1 ? `Factura unificada (${item.quantidade_servicos} servicos)` : item.procedimentos[0] || 'Procedimento'}
                  </Text>
                  <Text style={styles.historyMeta}>{item.numero_factura || 'Sem factura'} • {formatDateTime(item.data_referencia)}</Text>
                  {item.quantidade_servicos > 1 && (
                    <Text style={styles.historyMeta}>
                      {item.procedimentos.slice(0, 3).join(' • ')}{item.procedimentos.length > 3 ? ' ...' : ''}
                    </Text>
                  )}
                </View>
                <Text style={styles.historyValue}>{money(item.total)}</Text>
              </View>
            ))}
          </View>
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Emitir factura</Text>
            <TextInput style={styles.input} value={numeroFactura} onChangeText={setNumeroFactura} placeholder="Numero da factura" placeholderTextColor={COLORS.textSecondary} />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void emitirFactura('pendente')}><Text style={styles.actionText}>Pendente</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void emitirFactura('parcial')}><Text style={styles.actionText}>Parcial</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void emitirFactura('pago')}><Text style={styles.actionText}>Pago</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalPagamentoParcial} transparent animationType="fade" onRequestClose={() => setModalPagamentoParcial(false)}>
        <View style={styles.overlay}>
          <View style={styles.mediumModalCard}>
            <Text style={styles.modalTitle}>Pagamento Parcial</Text>
            {itemPagamentoParcial && (
              <>
                <Text style={styles.modalSubtitle}>
                  Paciente: {itemPagamentoParcial.paciente_nome}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Serviço: {itemPagamentoParcial.procedimento}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Valor Total: {money(itemPagamentoParcial.valor)}
                </Text>
                {itemPagamentoParcial.valor_pago && (
                  <Text style={styles.modalSubtitle}>
                  Valor Já Pago: {money(itemPagamentoParcial.valor_pago)}
                </Text>
                )}
                <Text style={styles.modalSubtitle}>
                  Saldo Devedor: {money(Number(itemPagamentoParcial.valor || 0) - Number(itemPagamentoParcial.valor_pago || 0))}
                </Text>
                <TextInput 
                  style={styles.input} 
                  value={valorPagamentoParcial} 
                  onChangeText={setValorPagamentoParcial} 
                  placeholder="Valor do pagamento" 
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                />
                <View style={styles.actionsRow}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.secondary }]} onPress={processarPagamentoParcial}>
                    <Text style={styles.actionText}>Processar Pagamento</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.danger }]} onPress={() => setModalPagamentoParcial(false)}>
                    <Text style={styles.actionText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!grupoSelecionado} transparent animationType="fade" onRequestClose={() => setGrupoSelecionado(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unificar facturas</Text>
            <Text style={styles.unifiedSubtitle}>
              {grupoSelecionado ? `${grupoSelecionado.paciente_nome} • ${grupoSelecionado.items.length} servicos • ${money(grupoSelecionado.total)}` : ''}
            </Text>
            <TextInput style={styles.input} value={numeroFactura} onChangeText={setNumeroFactura} placeholder="Numero da factura unificada" placeholderTextColor={COLORS.textSecondary} />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void unificarFacturas('pendente')}><Text style={styles.actionText}>Pendente</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void unificarFacturas('parcial')}><Text style={styles.actionText}>Parcial</Text></TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => void unificarFacturas('pago')}><Text style={styles.actionText}>Pago</Text></TouchableOpacity>
            </View>
            {grupoSelecionado && (
              <>
                <TouchableOpacity
                  style={styles.unifiedPdfBtn}
                  onPress={() => exportHtmlAsPdf(buildUnifiedHtml(grupoSelecionado, numeroFactura.trim() || undefined), `factura-unificada-${grupoSelecionado.paciente_id || grupoSelecionado.paciente_nome}.pdf`)}
                >
                  <Text style={styles.unifiedPdfText}>Gerar PDF unificado</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unifiedPdfBtn, styles.printBtn]}
                  onPress={() => void handlePrintFacturaUnica(grupoSelecionado)}
                >
                  <Text style={[styles.unifiedPdfText, styles.printBtnText]}>Imprimir factura única</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  metricCard: { flexGrow: 1, minWidth: 150, backgroundColor: COLORS.surface, borderRadius: 18, padding: SPACING.md, ...SHADOWS.sm },
  metricIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  metricValue: { fontSize: 24, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  metricLabel: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary },
  filtersRow: { gap: SPACING.sm, paddingBottom: SPACING.md },
  unifiedCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#E5E7EB', ...SHADOWS.sm },
  unifiedTitle: { fontSize: TYPOGRAPHY.sizes.h4, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  unifiedSubtitle: { marginTop: 6, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary, lineHeight: 18 },
  unifiedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingTop: SPACING.md, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  unifiedPatient: { fontSize: TYPOGRAPHY.sizes.body, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  unifiedMeta: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary },
  unifyBtn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  unifyBtnText: { color: '#047857', fontSize: TYPOGRAPHY.sizes.small, fontWeight: TYPOGRAPHY.weights.semiBold },
  filterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#6D28D9', borderColor: '#6D28D9' },
  filterText: { color: COLORS.text, fontWeight: TYPOGRAPHY.weights.semiBold },
  filterTextActive: { color: COLORS.textInverse },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: '#E5E7EB', ...SHADOWS.sm },
  patient: { fontSize: TYPOGRAPHY.sizes.h4, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  procedure: { marginTop: 8, fontSize: TYPOGRAPHY.sizes.body, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  meta: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  statusChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  statusText: { fontSize: TYPOGRAPHY.sizes.small, fontWeight: TYPOGRAPHY.weights.semiBold },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  actionBtn: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { color: COLORS.text, fontSize: TYPOGRAPHY.sizes.small, fontWeight: TYPOGRAPHY.weights.semiBold },
  paymentInfo: { marginTop: 12, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  paymentText: { fontSize: 13, color: '#059669', fontWeight: '700' },
  debtText: { fontSize: 13, color: '#DC2626', fontWeight: '700', marginTop: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  faturadoBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DCFCE7' },
  faturadoLabel: { fontSize: 11, color: '#166534', fontWeight: '500' },
  faturadoValue: { fontWeight: '700' },
  metricsContainer: { marginBottom: SPACING.md },
  reportButtonContainer: { 
    position: 'absolute', 
    right: 0, 
    top: 0, 
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: SPACING.md, 
    paddingVertical: SPACING.sm, 
    borderRadius: 12,
    ...SHADOWS.sm 
  },
  reportButtonText: { 
    color: COLORS.textInverse, 
    fontSize: TYPOGRAPHY.sizes.small, 
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginLeft: SPACING.xs 
  },
  mediumModalCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: 20, 
    padding: SPACING.lg, 
    width: '90%', 
    maxWidth: 400,
    maxHeight: '80%',
    ...SHADOWS.lg 
  },
  modalSubtitle: { 
    fontSize: TYPOGRAPHY.sizes.small, 
    color: COLORS.textSecondary, 
    marginBottom: SPACING.sm 
  },
  footerCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: SPACING.md, borderWidth: 1, borderColor: '#E5E7EB', ...SHADOWS.sm },
  footerTitle: { fontSize: TYPOGRAPHY.sizes.h4, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text, marginBottom: SPACING.sm },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  historyTitle: { fontSize: TYPOGRAPHY.sizes.bodySmall, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  historyMeta: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary },
  historyValue: { fontSize: TYPOGRAPHY.sizes.bodySmall, fontWeight: TYPOGRAPHY.weights.bold, color: '#166534' },
  empty: { color: COLORS.textSecondary, fontSize: TYPOGRAPHY.sizes.small },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: SPACING.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 24, padding: SPACING.md, ...SHADOWS.md },
  modalTitle: { fontSize: TYPOGRAPHY.sizes.h4, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text, marginBottom: SPACING.md },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text },
  unifiedPdfBtn: { marginTop: SPACING.sm, backgroundColor: '#EEF2FF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  unifiedPdfText: { color: '#3730A3', fontSize: TYPOGRAPHY.sizes.small, fontWeight: TYPOGRAPHY.weights.semiBold },
  printBtn: { marginTop: SPACING.sm, backgroundColor: '#ECFDF5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  printBtnText: { color: '#047857', fontSize: TYPOGRAPHY.sizes.small, fontWeight: TYPOGRAPHY.weights.semiBold },
});

export default TratamentosFacturasPanel;
