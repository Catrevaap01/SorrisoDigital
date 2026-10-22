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
  useWindowDimensions,
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
  if (value === 'concluido') return { label: 'Concluído', bg: '#DCFCE7', text: '#166534' };
  if (value === 'cancelado') return { label: 'Cancelado', bg: '#FEE2E2', text: '#B91C1C' };
  return { label: 'Em execução', bg: '#DBEAFE', text: '#1D4ED8' };
};

const financialStatus = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'aguardando_factura') return { label: 'Aguardando factura', bg: '#FEE2E2', text: '#DC2626' };
  if (value === 'pendente') return { label: 'Pendente', bg: '#FEE2E2', text: '#DC2626' };
  if (value === 'parcial') return { label: 'Parcial', bg: '#FEF3C7', text: '#92400E' };
  if (value === 'pago') return { label: 'Pago', bg: '#DCFCE7', text: '#166534' };
  return { label: 'Sem factura', bg: '#E5E7EB', text: '#475569' };
};

const buildHtml = (item: TratamentoFinanceiroItem, numero?: string) => {
  const pago = Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0));
  const total = Number(item.valor || 0);
  const divida = Math.max(0, total - pago);
  const numFat = numero || item.numero_factura || `FT-${String(item.id || '').substring(0, 8).toUpperCase()}`;

  return `
    <div class="screen-toolbar no-print">
      <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; Factura / Recibo de Serviço</div>
      <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
    </div>

    <div class="a4-container">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0284c7; padding-bottom:14px; margin-bottom:22px;">
        <div>
          <div style="font-size:22px; font-weight:800; color:#0369a1; letter-spacing:-0.5px;">🦷 TeOdonto Angola</div>
          <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:3px; text-transform:uppercase;">Factura &bull; Recibo de Procedimento Odontológico</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Clínica Dentária Especializada &bull; Luanda, Angola</div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block; background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">FACTURA DE SERVIÇO</div>
          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:4px;">Nº ${numFat}</div>
          <div style="font-size:10.5px; color:#475569;">Data: ${formatDateTime(new Date().toISOString())}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            Identificação do Utente (Paciente)
          </div>
          <div style="font-size:13px; font-weight:700; color:#0f172a;">${item.paciente_nome}</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Contacto: ${item.paciente_telefone || 'Não informado'}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            Profissional Odontológico
          </div>
          <div style="font-size:13px; font-weight:700; color:#0f172a;">Dr(a). ${item.dentista_nome || 'Dentista Responsável'}</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">TeOdonto Angola &bull; Serviços Odontológicos</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:11px;">
        <thead>
          <tr style="background:#0284c7; color:#ffffff;">
            <th style="padding:10px 12px; text-align:left; font-size:10.5px;">Descrição do Procedimento Clínico</th>
            <th style="padding:10px 12px; text-align:center; font-size:10.5px; width:120px;">Estado Clínico</th>
            <th style="padding:10px 12px; text-align:right; font-size:10.5px; width:130px;">Valor Total</th>
            <th style="padding:10px 12px; text-align:right; font-size:10.5px; width:130px;">Valor Pago</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0;">
              <div style="font-weight:700; color:#0f172a; font-size:12px;">${item.procedimento}</div>
              <div style="font-size:10.5px; color:#64748b; margin-top:2px;">Registo nº ${item.id}</div>
            </td>
            <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:center;">
              <span style="padding:3px 8px; border-radius:4px; font-size:9.5px; font-weight:700; background:#dbeafe; color:#1d4ed8;">
                ${item.status_clinico || 'Realizado'}
              </span>
            </td>
            <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">
              ${money(total)}
            </td>
            <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700; color:#16a34a; font-size:12px;">
              ${money(pago)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
        <div style="width:290px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
            <span style="color:#64748b;">Subtotal Serviço:</span>
            <span style="font-weight:700; color:#0f172a;">${money(total)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
            <span style="color:#16a34a; font-weight:600;">Valor Liquidado:</span>
            <span style="font-weight:700; color:#16a34a;">${money(pago)}</span>
          </div>
          ${divida > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
              <span style="color:#dc2626; font-weight:600;">Saldo Pendente:</span>
              <span style="font-weight:700; color:#dc2626;">${money(divida)}</span>
            </div>
          ` : ''}
          <div style="border-top:2px solid #0284c7; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#0f172a;">Estado Financeiro:</span>
            <span style="font-size:10.5px; font-weight:800; color:${divida <= 0 ? '#16a34a' : '#d97706'};">
              ${divida <= 0 ? 'TOTALMENTE PAGO' : 'PAGAMENTO PENDENTE'}
            </span>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:40px; margin-top:50px; page-break-inside:avoid;">
        <div style="flex:1; text-align:center;">
          <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
            Assinatura do Paciente / Responsável
          </div>
          <div style="font-size:9.5px; color:#64748b;">Conforme com a prestação do serviço</div>
        </div>
        <div style="flex:1; text-align:center;">
          <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
            Assinatura / Carimbo Autorizado
          </div>
          <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola &bull; Departamento de Tesouraria</div>
        </div>
      </div>

      <div style="margin-top:36px; text-align:center; color:#94a3b8; font-size:9.5px; border-top:1px solid #e2e8f0; padding-top:8px;">
        Obrigado por escolher a TeOdonto Angola &bull; Documento emitido para efeitos legais e fiscais
      </div>
    </div>
  `;
};

const buildUnifiedHtml = (grupo: GrupoFacturaUnificada, numero?: string) => {
  const totalGeral = Number(grupo.total || 0);
  const totalPago = grupo.items.reduce((sum, item) => sum + Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0)), 0);
  const totalPendente = Math.max(0, totalGeral - totalPago);
  const numDoc = numero || `FAT-UNI-${String(grupo.paciente_id || Date.now()).substring(0, 8).toUpperCase()}`;

  return `
    <div class="screen-toolbar no-print">
      <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; Factura Unificada Consolidada</div>
      <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
    </div>

    <div class="a4-container">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0284c7; padding-bottom:14px; margin-bottom:22px;">
        <div>
          <div style="font-size:22px; font-weight:800; color:#0369a1; letter-spacing:-0.5px;">🦷 TeOdonto Angola</div>
          <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:3px; text-transform:uppercase;">Factura Global Unificada de Tratamentos</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Clínica Dentária Especializada &bull; Luanda, Angola</div>
        </div>
        <div style="text-align:right;">
          <div style="display:inline-block; background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">FACTURA CONSOLIDADA</div>
          <div style="font-size:11.5px; font-weight:800; color:#0f172a; margin-top:4px;">Nº ${numDoc}</div>
          <div style="font-size:10.5px; color:#475569;">Data: ${formatDateTime(new Date().toISOString())}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            Titular da Factura (Paciente)
          </div>
          <div style="font-size:14px; font-weight:700; color:#0f172a;">${grupo.paciente_nome}</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Contacto: ${grupo.paciente_telefone || 'Não informado'}</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
            Resumo dos Atendimentos
          </div>
          <div style="font-size:12px; font-weight:600; color:#0f172a;">Total de Serviços Inclusos: <strong>${grupo.items.length}</strong></div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Corpo Clínico: ${grupo.dentistas.length > 0 ? grupo.dentistas.join(', ') : 'Especialistas TeOdonto'}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:10.5px;">
        <thead>
          <tr style="background:#0284c7; color:#ffffff;">
            <th style="padding:9px 10px; text-align:left; font-size:10px;">Item</th>
            <th style="padding:9px 10px; text-align:left; font-size:10px;">Procedimento Realizado</th>
            <th style="padding:9px 10px; text-align:left; font-size:10px;">Dentista</th>
            <th style="padding:9px 10px; text-align:right; font-size:10px; width:110px;">Preço Tabela</th>
            <th style="padding:9px 10px; text-align:right; font-size:10px; width:110px;">Valor Pago</th>
            <th style="padding:9px 10px; text-align:center; font-size:10px; width:90px;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${grupo.items.map((item, idx) => {
            const vTotal = Number(item.valor || 0);
            const vPago = Number(item.valor_pago !== undefined && item.valor_pago !== null ? item.valor_pago : (item.status_financeiro === 'pago' ? item.valor : 0));
            const isPago = vPago >= vTotal;
            return `
              <tr style="page-break-inside:avoid;">
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:600;">${idx + 1}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; font-weight:700; color:#0f172a;">${item.procedimento}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; color:#475569;">${item.dentista_nome || 'Dentista'}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600;">${money(vTotal)}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700; color:#16a34a;">${money(vPago)}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #e2e8f0; text-align:center;">
                  <span style="padding:2px 6px; border-radius:4px; font-size:9px; font-weight:700; background:${isPago ? '#dcfce7' : '#fee2e2'}; color:${isPago ? '#166534' : '#991b1b'};">
                    ${isPago ? 'PAGO' : 'PENDENTE'}
                  </span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
        <div style="width:310px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
            <span style="color:#64748b;">Subtotal Bruto (${grupo.items.length} itens):</span>
            <span style="font-weight:700; color:#0f172a;">${money(totalGeral)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
            <span style="color:#16a34a; font-weight:600;">Total Liquidado:</span>
            <span style="font-weight:700; color:#16a34a;">${money(totalPago)}</span>
          </div>
          ${totalPendente > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
              <span style="color:#dc2626; font-weight:600;">Saldo Pendente Global:</span>
              <span style="font-weight:700; color:#dc2626;">${money(totalPendente)}</span>
            </div>
          ` : ''}
          <div style="border-top:2px solid #0284c7; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:#0f172a;">Total da Factura:</span>
            <span style="font-size:15px; font-weight:800; color:#0369a1;">${money(totalGeral)}</span>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:40px; margin-top:50px; page-break-inside:avoid;">
        <div style="flex:1; text-align:center;">
          <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
            Assinatura do Paciente / Responsável
          </div>
          <div style="font-size:9.5px; color:#64748b;">Conforme com a discriminação dos serviços</div>
        </div>
        <div style="flex:1; text-align:center;">
          <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
            Direcção Financeira & Tesouraria
          </div>
          <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola &bull; Emitido Electronicamente</div>
        </div>
      </div>

      <div style="margin-top:36px; text-align:center; color:#94a3b8; font-size:9.5px; border-top:1px solid #e2e8f0; padding-top:8px;">
        TeOdonto Angola &bull; Clínica Especializada em Medicina Dentária e Ortodontia &bull; Luanda
      </div>
    </div>
  `;
};

const TratamentosFacturasPanel: React.FC<Props> = ({ items, loading, onRefresh }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
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
    
    const getCalculatedStatus = (item: any) => {
      const dbStatus = String(item.status_financeiro || 'sem_factura').toLowerCase();
      const isParcial = item.valor_pago != null && item.valor_pago > 0 && item.valor_pago < Number(item.valor || 0);
      if (isParcial && dbStatus !== 'pendente' && dbStatus !== 'aguardando_factura' && dbStatus !== 'sem_factura') {
        return 'parcial';
      }
      return dbStatus;
    };
    
    return {
      planosAtivos: new Set(itemsFiltered.filter((item) => item.status_clinico !== 'cancelado').map((item) => item.plano_id)).size,
      aguardando: itemsFiltered.filter((item) => {
        const s = getCalculatedStatus(item);
        return s === 'aguardando_factura' || s === 'sem_factura';
      }).length,
      facturasHoje: itemsFiltered.filter((item) => item.factura_emitida_em && new Date(item.factura_emitida_em).toDateString() === today).length,
      pendentes: itemsFiltered.filter((item) => {
        const s = getCalculatedStatus(item);
        return ['aguardando_factura', 'sem_factura', 'pendente', 'parcial'].includes(s);
      }).length,
      receitaHoje,
      receitaSemana,
      pacientesAtendidosHoje,
      taxaFalta,
    };
  }, [items]);

  const filtered = useMemo(() => {
    if (filtro === 'todos') {
      return items;
    }
    return items.filter((item) => {
      const dbStatus = String(item.status_financeiro || 'sem_factura').toLowerCase();
      const isParcial = item.valor_pago != null && item.valor_pago > 0 && item.valor_pago < Number(item.valor || 0);
      let s = dbStatus;
      
      if (isParcial && dbStatus !== 'pendente' && dbStatus !== 'aguardando_factura' && dbStatus !== 'sem_factura') {
        s = 'parcial';
      }

      if (filtro === 'aguardando_factura') {
        return s === 'aguardando_factura' || s === 'sem_factura';
      }
      return s === filtro;
    });
  }, [filtro, items]);

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

    filtered.forEach((item) => {
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
      .filter((grupo) => grupo.items.length > 1)
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const emitirFactura = async (status: 'pendente' | 'parcial' | 'pago') => {
    if (!selected) return;
    const payload: any = {
      numero_factura: numeroFactura.trim() || `FT-${Date.now().toString().slice(-6)}`,
      status_financeiro: status,
      factura_emitida_em: new Date().toISOString(),
      pago_em: status === 'pago' ? new Date().toISOString() : null,
    };
    if (status === 'pago') {
      payload.valor_pago = selected.valor;
    }
    const result = await atualizarFinanceiroProcedimento(selected.id, payload);
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
      const payload: any = {
        numero_factura: numero,
        status_financeiro: status,
        factura_emitida_em: agora,
        pago_em: status === 'pago' ? agora : null,
      };
      if (status === 'pago') {
        payload.valor_pago = item.valor;
      }
      const result = await atualizarFinanceiroProcedimento(item.id, payload);

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
      valor_pago: item.valor,
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
                <Text style={styles.unifiedSubtitle}>Pacientes com mais de um serviço pendente podem receber uma única factura com o valor total somado.</Text>
                {gruposUnificaveis.map((grupo) => (
                  <View key={grupo.paciente_id || grupo.paciente_nome} style={[styles.unifiedRow, isMobile && styles.unifiedRowMobile]}>
                    <View style={[styles.unifiedInfo, isMobile && styles.unifiedInfoMobile]}>
                      <Text style={styles.unifiedPatient}>{grupo.paciente_nome}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.dentistas.join(' • ')}</Text>
                      <Text style={styles.unifiedMeta}>{grupo.items.length} serviços • {money(grupo.total)}</Text>
                    </View>
                    <TouchableOpacity style={[styles.unifyBtn, isMobile && styles.unifiedActionBtnMobile]} onPress={() => { setNumeroFactura(''); setGrupoSelecionado(grupo); }}>
                      <Text style={styles.unifyBtnText}>Unificar facturas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.printBtn, isMobile && styles.unifiedActionBtnMobile]} onPress={() => void handlePrintFacturaUnica(grupo)}>
                      <Text style={styles.printBtnText}>Imprimir factura única</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {(() => {
            if (filtered.length === 0) {
              return <View style={styles.footerCard}><Text style={styles.empty}>Nenhum procedimento encontrado.</Text></View>;
            }
            return filtered.map((item) => {
              const clinical = clinicalStatus(item.status_clinico);
              const financial = financialStatus(item.status_financeiro);
              const valorTotal = Number(item.valor || 0);
              const valorPagoCalculado = item.status_financeiro === 'pago'
                ? valorTotal
                : Number(
                    item.valor_pago !== undefined && item.valor_pago !== null
                      ? item.valor_pago
                      : 0
                  );
              const dividaPendente = Math.max(0, valorTotal - valorPagoCalculado);
              const isPagoFinal = String(item.status_financeiro || '').toLowerCase() === 'pago' || dividaPendente <= 0;
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
                    {(() => {
                      const basePago = item.valor_pago !== undefined && item.valor_pago !== null 
                                       ? item.valor_pago 
                                       : (item.status_financeiro === 'pago' ? item.valor : 0);
                      
                      const renderPago = item.status_financeiro === 'pago' ? Number(item.valor || 0) : Number(basePago || 0);
                      const renderDevedor = Math.max(0, Number(item.valor || 0) - renderPago);
                      
                      return (
                        <>
                          <Text style={styles.paymentText}>Valor Já Pago: {money(renderPago)}</Text>
                          <Text style={[styles.paymentText, renderDevedor > 0 ? styles.debtText : styles.paymentNeutralText]}>
                            Dívida Pendente: {money(renderDevedor)}
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                  <View style={styles.statusRow}>
                    <View style={[styles.statusChip, { backgroundColor: clinical.bg }]}><Text style={[styles.statusText, { color: clinical.text }]}>Clínico: {clinical.label}</Text></View>
                    <View style={[styles.statusChip, { backgroundColor: financial.bg }]}><Text style={[styles.statusText, { color: financial.text }]}>Financeiro: {financial.label}</Text></View>
                  </View>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => { setNumeroFactura(''); setSelected(item); }}><Text style={styles.actionText}>Emitir factura</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => emitirFacturaPagamento(item)}><Text style={styles.actionText}>Fatura pago</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => void handlePrintServico(item)}><Text style={styles.actionText}>Imprimir serviço</Text></TouchableOpacity>
                    {!isPagoFinal && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => abrirModalPagamentoParcial(item)}><Text style={styles.actionText}>Pagamento Parcial</Text></TouchableOpacity>
                    )}
                    {!isPagoFinal && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => void marcarPago(item)}><Text style={styles.actionText}>Marcar pago</Text></TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionBtn} onPress={() => void enviarWhatsapp(item)}><Text style={styles.actionText}>WhatsApp</Text></TouchableOpacity>
                  </View>
                </View>
              );
            });
          })()}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Histórico financeiro</Text>
            {historico.length === 0 ? <Text style={styles.empty}>Sem histórico financeiro.</Text> : historico.map((item) => (
              <View key={`h-${item.id}`} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>
                    {item.paciente_nome} • {item.quantidade_servicos > 1 ? `Factura unificada (${item.quantidade_servicos} serviços)` : item.procedimentos[0] || 'Procedimento'}
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Emitir factura</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} value={numeroFactura} onChangeText={setNumeroFactura} placeholder="Número da factura" placeholderTextColor={COLORS.textSecondary} />
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Pagamento Parcial</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setModalPagamentoParcial(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Unificar facturas</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setGrupoSelecionado(null)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.unifiedSubtitle}>
              {grupoSelecionado ? `${grupoSelecionado.paciente_nome} • ${grupoSelecionado.items.length} serviços • ${money(grupoSelecionado.total)}` : ''}
            </Text>
            <TextInput style={styles.input} value={numeroFactura} onChangeText={setNumeroFactura} placeholder="Número da factura unificada" placeholderTextColor={COLORS.textSecondary} />
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
  unifiedRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  unifiedInfo: { flex: 1, minWidth: 220 },
  unifiedInfoMobile: { minWidth: 0, width: '100%' },
  unifiedActionBtnMobile: { width: '100%', alignItems: 'center' },
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
  paymentNeutralText: { color: '#64748B' },
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
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: SPACING.md 
  },
  closeButton: { 
    padding: 4 
  },
});

export default TratamentosFacturasPanel;
