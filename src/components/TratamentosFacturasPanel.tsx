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
  if (isNaN(amount)) return 'AOA 0';
  return 'AOA ' + amount.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type Props = {
  items: TratamentoFinanceiroItem[];
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
  dentistId?: string; // Filter to show only this dentist's plans
  enableFiltering?: boolean; // Enable advanced filtering
  enableUnifiedPrinting?: boolean; // Enable unified invoice printing
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

const clinicalStatus = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'concluido') return { label: 'Concluido', bg: '#DCFCE7', text: '#166534' };
  if (value === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', text: '#B91C1C' };
  return { label: 'Em execucao', bg: '#DBEAFE', text: '#1D4ED8' };
};

const financialStatus = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'aguardando_factura') return { label: 'Aguardando factura', bg: '#FFF7ED', text: '#C2410C' };
  if (value === 'pendente') return { label: 'Pendente', bg: '#FEF3C7', text: '#92400E' };
  if (value === 'parcial') return { label: 'Parcial', bg: '#E0E7FF', text: '#4338CA' };
  if (value === 'pago') return { label: 'Pago', bg: '#DCFCE7', text: '#166534' };
  return { label: 'Sem factura', bg: '#E5E7EB', text: '#475569' };
};

const buildHtml = (item: TratamentoFinanceiroItem, numero?: string) => `
  <div style="max-width:800px; margin:0 auto; padding:40px; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom: 2px solid #efeff1; padding-bottom: 20px;">
      <div style="flex:1;">
        <h1 style="color:#7C3AED; margin:0; font-size:28px; letter-spacing:-1px;">SORRISO DIGITAL</h1>
        <p style="margin:5px 0; font-size:14px; color:#64748b;">Clínica Odontológica de Excelência</p>
        <p style="margin:5px 0; font-size:12px; color:#94a3b8;">Av. Deolinda Rodrigues, Luanda, Angola</p>
      </div>
      <div style="text-align:right;">
        <h2 style="margin:0; color:#1e293b; font-size:18px;">RECIBO / FACTURA</h2>
        <p style="margin:5px 0; font-weight:bold; color:#7C3AED;"># ${numero || item.numero_factura || 'PROVISÓRIO'}</p>
        <p style="margin:5px 0; font-size:13px;">Data: ${formatDateTime(new Date().toISOString())}</p>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:40px;">
      <div>
        <h3 style="font-size:12px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px; border-bottom:1px solid #f1f5f9;">Dados do Paciente</h3>
        <p style="margin:4px 0; font-weight:bold; color:#1e293b;">${item.paciente_nome}</p>
        <p style="margin:4px 0; font-size:13px;">${item.paciente_telefone || 'Telefone não informado'}</p>
      </div>
      <div>
        <h3 style="font-size:12px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px; border-bottom:1px solid #f1f5f9;">Profissional Responsável</h3>
        <p style="margin:4px 0; font-weight:bold; color:#1e293b;">Dr(a). ${item.dentista_nome}</p>
        <p style="margin:4px 0; font-size:13px;">Especialidade: ${item.especialidade}</p>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
      <thead>
        <tr style="background-color:#f8fafc;">
          <th style="text-align:left; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">DESCRIÇÃO DO SERVIÇO</th>
          <th style="text-align:center; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">SESSÃO</th>
          <th style="text-align:right; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">VALOR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9;">
            <div style="font-weight:bold; color:#1e293b;">${item.procedimento}</div>
            <div style="font-size:12px; color:#64748b; margin-top:4px;">${item.observacoes || 'Procedimento odontológico realizado.'}</div>
          </td>
          <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; text-align:center;">${item.sessao_numero}</td>
          <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:bold;">${formatCurrency(item.valor)}</td>
        </tr>
      </tbody>
    </table>

        <div style="display:flex; justify-content:flex-end;">
      <div style="width:250px;">
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Subtotal</span>
          <span style="font-weight:500;">${formatCurrency(item.valor)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Valor Pago</span>
          <span style="font-weight:500; color: #166534;">${formatCurrency(item.valor_pago || 0)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:15px 0;">
          <span style="font-weight:bold; color:#1e293b; font-size:18px;">TOTAL RECEBIDO</span>
          <span style="font-weight:bold; color:#7C3AED; font-size:18px;">${formatCurrency(item.valor_pago || 0)}</span>
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
          <th style="text-align:left; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">TRATAMENTOS REALIZADOS</th>
          <th style="text-align:left; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">DENTISTA</th>
          <th style="text-align:right; padding:12px; border-bottom:2px solid #e2e8f0; font-size:13px; color:#64748b;">VALOR</th>
        </tr>
      </thead>
      <tbody>
        ${grupo.items.map((item) => `
          <tr>
            <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9;">
              <div style="font-weight:bold; color:#1e293b;">${item.procedimento}</div>
              <div style="font-size:11px; color:#94a3b8;">Sessão ${item.sessao_numero} • ${formatDateTime(item.data_hora)}</div>
            </td>
            <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; font-size:13px;">Dr(a). ${item.dentista_nome}</td>
            <td style="padding:15px 12px; border-bottom:1px solid #f1f5f9; text-align:right; font-weight:bold;">${formatCurrency(item.valor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="display:flex; justify-content:flex-end;">
      <div style="width:250px;">
        <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f1f5f9;">
          <span style="color:#64748b;">Serviços (${grupo.items.length})</span>
          <span style="font-weight:500;">${formatCurrency(grupo.total)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding:15px 0;">
          <span style="font-weight:bold; color:#1e293b; font-size:18px;">VALOR TOTAL</span>
          <span style="font-weight:bold; color:#7C3AED; font-size:18px;">${formatCurrency(grupo.total)}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:60px; padding-top:20px; border-top:1px solid #f1f5f9; text-align:center; color:#94a3b8; font-size:12px;">
      <p>Obrigado por escolher o Sorriso Digital. Este é um resumo consolidado de seus tratamentos.</p>
      <p>Emitido em ${formatDateTime(new Date().toISOString())}</p>
    </div>
  </div>
`;

const TratamentosFacturasPanel: React.FC<Props> = ({ items, loading, onRefresh, dentistId, enableFiltering = true, enableUnifiedPrinting = true }) => {
  const [filtro, setFiltro] = useState<FiltroFinanceiro>('todos');
  const [selected, setSelected] = useState<TratamentoFinanceiroItem | null>(null);
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoFacturaUnificada | null>(null);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [partialPaymentModal, setPartialPaymentModal] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedForPartial, setSelectedForPartial] = useState<TratamentoFinanceiroItem | null>(null);
  const [pacienteFilter, setPacienteFilter] = useState('');
  const [dentistaFilter, setDentistaFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const resumo = useMemo(() => {
    const today = new Date().toDateString();
    
    // Filter items by dentist if dentistId is provided
    const itemsFiltered = dentistId 
      ? items.filter((item) => item.dentista_id === dentistId)
      : items;
    
    // Buscar valores pagos de planos de tratamento
    const buscarValoresPlanosPagos = async () => {
      try {
        // Buscar planos de tratamento com pagamentos
        const { data: planosPagos, error } = await supabase
          .from('planos_tratamento')
          .select(`
            id,
            paciente_id,
            dentista_id,
            valor_total,
            valor_pago,
            valor_pendente,
            created_at,
            updated_at
          `)
          .eq('dentista_id', dentistId || '')
          .in('valor_pago', 'is', 'not', 'null')
          .order('updated_at', { ascending: false });
        
        if (!error && planosPagos) {
          // Adicionar valores dos planos ao resumo
          const totalPlanosPagos = planosPagos.reduce((sum, plano) => {
            return sum + Number(plano.valor_pago || 0);
          }, 0);
          
          const totalPlanosPendentes = planosPagos.reduce((sum, plano) => {
            const valorTotal = Number(plano.valor_total || 0);
            const valorPago = Number(plano.valor_pago || 0);
            const valorPendente = valorTotal - valorPago;
            return sum + Math.max(0, valorPendente);
          }, 0);
          
          return {
            totalPlanosPagos,
            totalPlanosPendentes
          };
        }
        
        return { totalPlanosPagos: 0, totalPlanosPendentes: 0 };
      } catch (err) {
        console.warn('Erro ao buscar valores de planos pagos:', err);
        return { totalPlanosPagos: 0, totalPlanosPendentes: 0 };
      }
    };
    
    return {
      planosAtivos: new Set(itemsFiltered.filter((item) => item.status_clinico !== 'cancelado').map((item) => item.plano_id)).size,
      aguardando: itemsFiltered.filter((item) => item.status_financeiro === 'aguardando_factura').length,
      facturasHoje: itemsFiltered.filter((item) => item.factura_emitida_em && new Date(item.factura_emitida_em).toDateString() === today).length,
      pendentes: itemsFiltered.filter((item) => ['aguardando_factura', 'pendente', 'parcial'].includes(item.status_financeiro)).length,
      valorTotal: itemsFiltered.reduce((sum, item) => sum + Number(item.valor || 0), 0),
      valorPago: itemsFiltered.reduce((sum, item) => sum + Number(item.valor_pago || 0), 0), // Only show valor_pago
      valorPendente: itemsFiltered.reduce((sum, item) => {
        const valorTotal = Number(item.valor || 0);
        const valorPago = Number(item.valor_pago || 0);
        const valorPendente = valorTotal - valorPago;
        return sum + Math.max(0, valorPendente); // Show amount still owed
      }, 0),
      // Valores de planos de tratamento já pagos
      valorPlanosPagos: buscarValoresPlanosPagos().then(result => result.totalPlanosPagos || 0),
      valorPlanosPendentes: buscarValoresPlanosPagos().then(result => result.totalPlanosPendentes || 0),
    };
  }, [items, dentistId]);

  const filtered = useMemo(() => {
    let filteredItems = items;
    
    // Filter by dentist if dentistId is provided
    if (dentistId) {
      filteredItems = filteredItems.filter((item) => item.dentista_id === dentistId);
    }
    
    // Apply financial status filter
    if (filtro !== 'todos') {
      filteredItems = filteredItems.filter((item) => item.status_financeiro === filtro);
    }
    
    // Apply advanced filters if enabled
    if (enableFiltering) {
      if (pacienteFilter) {
        filteredItems = filteredItems.filter((item) => 
          item.paciente_nome.toLowerCase().includes(pacienteFilter.toLowerCase())
        );
      }
      if (dentistaFilter) {
        filteredItems = filteredItems.filter((item) => 
          item.dentista_nome.toLowerCase().includes(dentistaFilter.toLowerCase())
        );
      }
    }
    
    return filteredItems;
  }, [filtro, items, dentistId, pacienteFilter, dentistaFilter, enableFiltering]);

  const historico = useMemo<HistoricoFinanceiroAgrupado[]>(() => {
    const grupos = new Map<string, HistoricoFinanceiroAgrupado>();

    // Filter items by dentist if dentistId is provided
    const itemsFiltered = dentistId 
      ? items.filter((item) => item.dentista_id === dentistId)
      : items;

    itemsFiltered
      .filter((item) => item.numero_factura || item.pago_em)
      .forEach((item) => {
        const chave = item.numero_factura ? `factura:${item.numero_factura}` : `item:${item.id}`;
        const dataReferencia = item.factura_emitida_em || item.pago_em || item.data_hora;
        const existente = grupos.get(chave);

        if (existente) {
          existente.total += Number(item.valor || 0);
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
          total: Number(item.valor || 0),
          quantidade_servicos: 1,
          procedimentos: item.procedimento ? [item.procedimento] : [],
        });
      });

    return Array.from(grupos.values())
      .sort((a, b) => new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime())
      .slice(0, 8);
  }, [items, dentistId]);

  const gruposUnificaveis = useMemo(() => {
    const grupos = new Map<string, GrupoFacturaUnificada>();

    // Filter items by dentist if dentistId is provided
    const itemsFiltered = dentistId 
      ? items.filter((item) => item.dentista_id === dentistId)
      : items;

    itemsFiltered.forEach((item) => {
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
      .filter((grupo) => grupo.items.length > 1 && grupo.dentistas.length > 1 && grupo.items.every((item) => item.dentista_id === dentistId))
      .sort((a, b) => a.paciente_nome.localeCompare(b.paciente_nome));
  }, [items, dentistId]);

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
      text2: `${grupoSelecionado.paciente_nome} • ${formatCurrency(grupoSelecionado.total)}`,
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

  const openPartialPaymentModal = (item: TratamentoFinanceiroItem) => {
    setSelectedForPartial(item);
    setPartialAmount('');
    setPartialPaymentModal(true);
  };

  const processPartialPayment = async () => {
    if (!selectedForPartial || !partialAmount || Number(partialAmount) <= 0) {
      Toast.show({ type: 'error', text1: 'Valor inválido', text2: 'Digite um valor maior que zero' });
      return;
    }

    const valorTotal = Number(selectedForPartial.valor || 0);
    const valorPago = Number(partialAmount);
    
    if (valorPago >= valorTotal) {
      Toast.show({ type: 'error', text1: 'Valor excede o total', text2: 'Use "Marcar pago" para pagamento completo' });
      return;
    }

    const result = await atualizarFinanceiroProcedimento(selectedForPartial.id, {
      status_financeiro: 'parcial',
      valor_pago: valorPago,
      valor_pendente: valorTotal - valorPago,
      pago_parcial_em: new Date().toISOString(),
      factura_emitida_em: selectedForPartial.factura_emitida_em || new Date().toISOString(),
      numero_factura: selectedForPartial.numero_factura || `FT-${Date.now().toString().slice(-6)}`,
    });
    
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Pagamento parcial registrado', text2: `${formatCurrency(valorPago)} pago, ${formatCurrency(valorTotal - valorPago)} pendente` });
      setPartialPaymentModal(false);
      setSelectedForPartial(null);
      setPartialAmount('');
      onRefresh();
    } else {
      Toast.show({ type: 'error', text1: 'Erro ao registrar pagamento', text2: result.error || 'Tente novamente' });
    }
  };

  const enviarWhatsapp = async (item: TratamentoFinanceiroItem) => {
    if (!item.paciente_telefone) return Toast.show({ type: 'info', text1: 'Paciente sem telefone' });
    const phone = item.paciente_telefone.replace(/\D/g, '');
    await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá ${item.paciente_nome}, procedimento ${item.procedimento} no valor de ${formatCurrency(item.valor)}.`)}`);
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
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={!!loading} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.metricsRow}>
              {[
                ['Planos ativos', resumo.planosAtivos],
                ['Aguardando factura', resumo.aguardando],
                ['Facturas emitidas hoje', resumo.facturasHoje],
                ['Pagamentos pendentes', resumo.pendentes],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.metricCard}>
                  <Text style={styles.metricValue}>{value}</Text>
                  <Text style={styles.metricLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {FILTROS.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.filterChip, filtro === item.key && styles.filterChipActive]} onPress={() => setFiltro(item.key)}>
                  <Text style={[styles.filterText, filtro === item.key && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              {enableFiltering && (
                <TouchableOpacity 
                  style={[styles.filterChip, showAdvancedFilters && styles.filterChipActive]} 
                  onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Text style={[styles.filterText, showAdvancedFilters && styles.filterTextActive]}>Filtros</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            
            {enableFiltering && showAdvancedFilters && (
              <View style={styles.advancedFilters}>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Filtrar por paciente..."
                  value={pacienteFilter}
                  onChangeText={setPacienteFilter}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <TextInput
                  style={styles.filterInput}
                  placeholder="Filtrar por dentista..."
                  value={dentistaFilter}
                  onChangeText={setDentistaFilter}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            )}

            {enableUnifiedPrinting && gruposUnificaveis.length > 0 && (
              <View style={styles.unifiedCard}>
                <Text style={styles.unifiedTitle}>Facturas unificadas por paciente</Text>
                <Text style={styles.unifiedSubtitle}>Pacientes com múltiplas consultas podem receber uma factura unificada com valor total.</Text>
                {gruposUnificaveis.map((grupo) => (
                  <View key={grupo.paciente_id || grupo.paciente_nome} style={styles.unifiedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unifiedPatient}>{grupo.paciente_nome}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.dentistas.join(' • ')}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.items.length} servicos • {formatCurrency(grupo.total)}</Text>
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
        }
        renderItem={({ item }) => {
          const clinical = clinicalStatus(item.status_clinico);
          const financial = financialStatus(item.status_financeiro);
          return (
            <View style={styles.card}>
              <Text style={styles.patient}>{item.paciente_nome}</Text>
              <Text style={styles.meta}>Dr(a). {item.dentista_nome} • {item.especialidade}</Text>
              <Text style={styles.procedure}>{item.procedimento}</Text>
              <Text style={styles.meta}>Sessao {item.sessao_numero} • {formatCurrency(item.valor)} • {formatDateTime(item.data_hora)}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusChip, { backgroundColor: clinical.bg }]}><Text style={[styles.statusText, { color: clinical.text }]}>Clinico: {clinical.label}</Text></View>
                <View style={[styles.statusChip, { backgroundColor: financial.bg }]}><Text style={[styles.statusText, { color: financial.text }]}>Financeiro: {financial.label}</Text></View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => { setNumeroFactura(''); setSelected(item); }}><Text style={styles.actionText}>Emitir factura</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => exportHtmlAsPdf(buildHtml(item), `factura-servico-${item.id}.pdf`)}><Text style={styles.actionText}>Gerar PDF serviço</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void handlePrintServico(item)}><Text style={styles.actionText}>Imprimir serviço</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void marcarPago(item)}><Text style={styles.actionText}>Marcar pago</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.partialBtn]} onPress={() => openPartialPaymentModal(item)}><Text style={styles.actionText}>Pagamento parcial</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void enviarWhatsapp(item)}><Text style={styles.actionText}>WhatsApp</Text></TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
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
                <Text style={styles.historyValue}>{formatCurrency(item.total)}</Text>
              </View>
            ))}
          </View>
        }
        ListEmptyComponent={<View style={styles.footerCard}><Text style={styles.empty}>Nenhum procedimento encontrado.</Text></View>}
      />

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

      <Modal visible={!!grupoSelecionado} transparent animationType="fade" onRequestClose={() => setGrupoSelecionado(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unificar facturas</Text>
            <Text style={styles.unifiedSubtitle}>
              {grupoSelecionado ? `${grupoSelecionado.paciente_nome} • ${grupoSelecionado.items.length} servicos • ${formatCurrency(grupoSelecionado.total)}` : ''}
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

      <Modal visible={partialPaymentModal} transparent animationType="fade" onRequestClose={() => setPartialPaymentModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pagamento Parcial</Text>
            {selectedForPartial && (
              <>
                <Text style={styles.partialInfo}>Paciente: {selectedForPartial.paciente_nome}</Text>
                <Text style={styles.partialInfo}>Procedimento: {selectedForPartial.procedimento}</Text>
                <Text style={styles.partialInfo}>Valor total: {formatCurrency(selectedForPartial.valor)}</Text>
                <Text style={styles.partialInfo}>Valor pendente: {formatCurrency(selectedForPartial.valor_pendente || selectedForPartial.valor)}</Text>
              </>
            )}
            <TextInput 
              style={styles.input} 
              value={partialAmount} 
              onChangeText={setPartialAmount} 
              placeholder="Valor do pagamento parcial" 
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary} 
            />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setPartialPaymentModal(false)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={processPartialPayment}>
                <Text style={styles.actionText}>Confirmar Pagamento</Text>
              </TouchableOpacity>
            </View>
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
  primaryMetric: { backgroundColor: COLORS.primary },
  successMetric: { backgroundColor: COLORS.success },
  warningMetric: { backgroundColor: COLORS.warning },
  infoMetric: { backgroundColor: COLORS.info },
  metricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  metricValue: { fontSize: 24, fontWeight: TYPOGRAPHY.weights.bold, color: '#ffffff', textAlign: 'center' },
  metricLabel: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: '#ffffff', textAlign: 'center', fontWeight: '600' },
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
  partialBtn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 },
  partialInfo: { fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary, marginBottom: 4 },
  cancelBtn: { backgroundColor: '#FEE2E2', borderColor: '#B91C1C' },
  confirmBtn: { backgroundColor: '#DCFCE7', borderColor: '#166534' },
  advancedFilters: { 
    backgroundColor: COLORS.surface, 
    padding: SPACING.sm, 
    marginBottom: SPACING.md, 
    borderRadius: 12,
    ...SHADOWS.sm 
  },
  filterInput: { 
    backgroundColor: '#F8FAFC', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    color: COLORS.text,
    marginBottom: 8,
    fontSize: TYPOGRAPHY.sizes.small
  },
});

export default TratamentosFacturasPanel;
