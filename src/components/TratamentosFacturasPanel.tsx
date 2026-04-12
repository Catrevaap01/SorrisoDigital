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
import Toast from 'react-native-toast-message';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
import {
  atualizarFinanceiroProcedimento,
  TratamentoFinanceiroItem,
} from '../services/secretarioService';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { formatDateTime } from '../utils/helpers';

type Props = {
  items: TratamentoFinanceiroItem[];
  loading?: boolean;
  onRefresh: () => void | Promise<void>;
};

type FiltroFinanceiro = 'todos' | 'aguardando_factura' | 'pendente' | 'pago' | 'parcial';

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
  if (value === 'aguardando_factura') return { label: 'Aguardando factura', bg: '#FFF7ED', text: '#C2410C' };
  if (value === 'pendente') return { label: 'Pendente', bg: '#FEF3C7', text: '#92400E' };
  if (value === 'parcial') return { label: 'Parcial', bg: '#E0E7FF', text: '#4338CA' };
  if (value === 'pago') return { label: 'Pago', bg: '#DCFCE7', text: '#166534' };
  return { label: 'Sem factura', bg: '#E5E7EB', text: '#475569' };
};

const buildHtml = (item: TratamentoFinanceiroItem, numero?: string) => `
  <div style="max-width:760px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;color:#0f172a;">
    <h1 style="color:#1d4ed8;">Factura de Tratamento</h1>
    <p><strong>Factura:</strong> ${numero || item.numero_factura || 'Sem numero'}</p>
    <p><strong>Paciente:</strong> ${item.paciente_nome}</p>
    <p><strong>Dentista:</strong> ${item.dentista_nome}</p>
    <p><strong>Especialidade:</strong> ${item.especialidade}</p>
    <p><strong>Procedimento:</strong> ${item.procedimento}</p>
    <p><strong>Sessao:</strong> ${item.sessao_numero}</p>
    <p><strong>Valor:</strong> ${money(item.valor)}</p>
    <p><strong>Data:</strong> ${formatDateTime(item.data_hora)}</p>
  </div>
`;

const TratamentosFacturasPanel: React.FC<Props> = ({ items, loading, onRefresh }) => {
  const [filtro, setFiltro] = useState<FiltroFinanceiro>('todos');
  const [selected, setSelected] = useState<TratamentoFinanceiroItem | null>(null);
  const [numeroFactura, setNumeroFactura] = useState('');

  const resumo = useMemo(() => {
    const today = new Date().toDateString();
    return {
      planosAtivos: new Set(items.filter((item) => item.status_clinico !== 'cancelado').map((item) => item.plano_id)).size,
      aguardando: items.filter((item) => item.status_financeiro === 'aguardando_factura').length,
      facturasHoje: items.filter((item) => item.factura_emitida_em && new Date(item.factura_emitida_em).toDateString() === today).length,
      pendentes: items.filter((item) => ['aguardando_factura', 'pendente', 'parcial'].includes(item.status_financeiro)).length,
    };
  }, [items]);

  const filtered = useMemo(() => (
    filtro === 'todos' ? items : items.filter((item) => item.status_financeiro === filtro)
  ), [filtro, items]);

  const historico = useMemo(() => items.filter((item) => item.numero_factura || item.pago_em).slice(0, 8), [items]);

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

  const enviarWhatsapp = async (item: TratamentoFinanceiroItem) => {
    if (!item.paciente_telefone) return Toast.show({ type: 'info', text1: 'Paciente sem telefone' });
    const phone = item.paciente_telefone.replace(/\D/g, '');
    await Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá ${item.paciente_nome}, procedimento ${item.procedimento} no valor de ${money(item.valor)}.`)}`);
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
            </ScrollView>
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
              <Text style={styles.meta}>Sessao {item.sessao_numero} • {money(item.valor)} • {formatDateTime(item.data_hora)}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusChip, { backgroundColor: clinical.bg }]}><Text style={[styles.statusText, { color: clinical.text }]}>Clinico: {clinical.label}</Text></View>
                <View style={[styles.statusChip, { backgroundColor: financial.bg }]}><Text style={[styles.statusText, { color: financial.text }]}>Financeiro: {financial.label}</Text></View>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setSelected(item)}><Text style={styles.actionText}>Emitir factura</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => exportHtmlAsPdf(buildHtml(item), `factura-${item.id}.pdf`)}><Text style={styles.actionText}>Gerar PDF</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => exportHtmlAsPdf(buildHtml(item), `factura-${item.id}.pdf`)}><Text style={styles.actionText}>Imprimir</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => void marcarPago(item)}><Text style={styles.actionText}>Marcar pago</Text></TouchableOpacity>
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
                  <Text style={styles.historyTitle}>{item.paciente_nome} • {item.procedimento}</Text>
                  <Text style={styles.historyMeta}>{item.numero_factura || 'Sem factura'} • {item.factura_emitida_em ? formatDateTime(item.factura_emitida_em) : formatDateTime(item.data_hora)}</Text>
                </View>
                <Text style={styles.historyValue}>{money(item.valor)}</Text>
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
    </>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md },
  metricCard: { flexGrow: 1, minWidth: 150, backgroundColor: COLORS.surface, borderRadius: 18, padding: SPACING.md, ...SHADOWS.sm },
  metricValue: { fontSize: 28, fontWeight: TYPOGRAPHY.weights.bold, color: COLORS.text },
  metricLabel: { marginTop: 4, fontSize: TYPOGRAPHY.sizes.small, color: COLORS.textSecondary },
  filtersRow: { gap: SPACING.sm, paddingBottom: SPACING.md },
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
});

export default TratamentosFacturasPanel;
