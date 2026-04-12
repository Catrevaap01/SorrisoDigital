import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

type Props = NativeStackScreenProps<DentistaStackParamList, 'PlanoTratamento'>;

interface Procedimento {
  id?: string;
  descricao: string;
  dente: string;
  status: 'pendente' | 'em_curso' | 'concluido' | 'cancelado';
  valor: string;
  observacoes: string;
  sessao_numero?: number;
  status_financeiro?: string;
}

const STATUS_PROC: Record<string, { label: string; cor: string; icone: string }> = {
  pendente:  { label: 'Pendente',   cor: '#FFA726', icone: 'time-outline' },
  em_curso:  { label: 'Em Curso',   cor: '#42A5F5', icone: 'construct-outline' },
  concluido: { label: 'Concluído',  cor: '#66BB6A', icone: 'checkmark-circle-outline' },
  cancelado: { label: 'Cancelado',  cor: '#EF5350', icone: 'close-circle-outline' },
};

const PROC_VAZIO: Procedimento = { descricao: '', dente: '', status: 'pendente', valor: '', observacoes: '' };

const PROCEDIMENTOS_COMUNS = [
  'Extração simples', 'Extração cirúrgica', 'Tratamento de canal',
  'Restauração compósito', 'Restauração amálgama', 'Profilaxia / Limpeza',
  'Clareamento dental', 'Aparelho ortodôntico', 'Consulta de avaliação',
  'Radiografia periapical', 'Radiografia panorâmica', 'Implante dentário',
  'Placa oclusal', 'Extração de siso', 'Gengivectomia',
];

const PlanoTratamentoScreen: React.FC<Props> = ({ route, navigation }) => {
  const { triagemId, pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [nomePacienteAtual, setNomePacienteAtual] = useState(pacienteNome || 'Paciente');
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Procedimento>(PROC_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [showSugestoes, setShowSugestoes] = useState(false);

  const carregarPlano = useCallback(async () => {
    const { data: pacienteData } = await supabase
      .from('profiles')
      .select('nome')
      .eq('id', pacienteId)
      .maybeSingle();

    if (pacienteData?.nome) {
      setNomePacienteAtual(pacienteData.nome);
    }
    // Carregar todos os planos do paciente e usar o mais recente para novos registos.
    let { data: planos } = await supabase
      .from('planos_tratamento')
      .select('id, created_at')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!planos || planos.length === 0) {
      const { data: novo } = await supabase
        .from('planos_tratamento')
        .insert({ paciente_id: pacienteId, dentista_id: profile?.id, triagem_id: triagemId })
        .select('id, created_at')
        .single();
      planos = novo ? [novo] : [];
    }

    if (planos && planos.length > 0) {
      const planoMaisRecente = planos[0];
      const planoIds = planos.map((item: any) => item.id).filter(Boolean);

      setPlanoId(planoMaisRecente.id);
      const { data: procs } = await supabase
        .from('procedimentos_tratamento')
        .select('*')
        .in('plano_id', planoIds)
        .order('created_at');
      setProcedimentos((procs || []).map((p: any) => ({ ...p, valor: String(p.valor || '') })));
    }
    setLoading(false);
  }, [pacienteId, profile?.id, triagemId]);

  useEffect(() => { carregarPlano(); }, [carregarPlano]);

  const abrirNovo = () => { setEditando(PROC_VAZIO); setModal(true); };
  const abrirEditar = (p: Procedimento) => { setEditando(p); setModal(true); };

  const salvarProcedimento = async () => {
    if (!editando.descricao.trim()) {
      Toast.show({ type: 'error', text1: 'Descreva o procedimento' });
      return;
    }
    if (!planoId) return;
    setSalvando(true);

    const payload = {
      plano_id: planoId,
      descricao: editando.descricao,
      dente: editando.dente,
      status: editando.status,
      valor: parseFloat(editando.valor) || 0,
      observacoes: editando.observacoes,
    };

    let error = null;
    if (editando.id) {
      const updateRes = await supabase.from('procedimentos_tratamento').update(payload).eq('id', editando.id);
      error = updateRes.error;
    } else {
      const insertRes = await supabase.from('procedimentos_tratamento').insert({
        ...payload,
        status_financeiro: 'aguardando_factura',
      });
      error = insertRes.error;

      if (error?.message?.toLowerCase().includes("status_financeiro")) {
        const fallbackRes = await supabase.from('procedimentos_tratamento').insert(payload);
        error = fallbackRes.error;
      }
    }

    if (error) {
      setSalvando(false);
      Toast.show({ type: 'error', text1: 'Erro ao guardar tratamento', text2: error.message });
      return;
    }

    const valorGuardado = parseFloat(editando.valor) || 0;
    const totalAtualizado = editando.id
      ? procedimentos.reduce((acc, item) => {
          if (item.id === editando.id) return acc + valorGuardado;
          return acc + (parseFloat(item.valor) || 0);
        }, 0)
      : procedimentos.reduce((acc, item) => acc + (parseFloat(item.valor) || 0), 0) + valorGuardado;

    setSalvando(false);
    setModal(false);
    carregarPlano();
    Toast.show({
      type: 'success',
      text1: 'Tratamento guardado',
      text2: `${nomePacienteAtual}: total acumulado ${totalAtualizado.toLocaleString('pt-AO')} Kz`,
    });
  };

  const excluir = async (id: string) => {
    const confirmar = () => supabase.from('procedimentos_tratamento').delete().eq('id', id).then(() => carregarPlano());
    if (Platform.OS === 'web') {
      if (window.confirm('Remover procedimento?')) confirmar();
    } else {
      Alert.alert('Remover', 'Deseja remover este procedimento?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: confirmar },
      ]);
    }
  };

  const totalEstimado = useMemo(
    () => procedimentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0),
    [procedimentos]
  );
  const totalConcluido = procedimentos.filter((p) => p.status === 'concluido').reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const isWeb = Platform.OS === 'web';

  return (
    <View style={s.container}>
      {/* Resumo */}
      <View style={s.resumo}>
        <Text style={s.resumoEyebrow}>Paciente selecionado</Text>
        <Text style={s.resumoSubTitle}>Aqui aparecem todos os procedimentos do paciente, mesmo quando foram registados em planos diferentes, e o valor total vai sendo somado automaticamente.</Text>
        <Text style={s.resumoTitle}>Plano de Tratamento — {nomePacienteAtual}</Text>
        <View style={s.resumoRow}>
          <View style={s.resumoCard}>
            <Text style={s.resumoNum}>{procedimentos.length}</Text>
            <Text style={s.resumoLabel}>Procedimentos</Text>
          </View>
          <View style={s.resumoCard}>
            <Text style={[s.resumoNum, { color: '#66BB6A' }]}>
              {procedimentos.filter((p) => p.status === 'concluido').length}
            </Text>
            <Text style={s.resumoLabel}>Concluídos</Text>
          </View>
          <View style={s.resumoCard}>
            <Text style={[s.resumoNum, { color: COLORS.primary }]}>
              {totalEstimado.toLocaleString('pt-AO')} Kz
            </Text>
            <Text style={s.resumoLabel}>Valor Total</Text>
          </View>
        </View>
        {totalConcluido > 0 && (
          <Text style={s.pago}>✓ Realizado: {totalConcluido.toLocaleString('pt-AO')} Kz</Text>
        )}
      </View>

      <FlatList
        data={procedimentos}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => {
          const info = STATUS_PROC[item.status] || STATUS_PROC.pendente;
          return (
            <View style={s.procCard}>
              <View style={[s.procStatus, { backgroundColor: info.cor }]}>
                <Ionicons name={info.icone as any} size={16} color="white" />
              </View>
              <View style={s.procInfo}>
                <Text style={s.procDesc}>{item.descricao}</Text>
                {item.dente ? <Text style={s.procMeta}>Dente: {item.dente}</Text> : null}
                <View style={s.procFooter}>
                  <View style={[s.procStatusBadge, { backgroundColor: info.cor + '20' }]}>
                    <Text style={[s.procStatusText, { color: info.cor }]}>{info.label}</Text>
                  </View>
                  {item.valor ? (
                    <Text style={s.procValor}>{parseFloat(item.valor).toLocaleString('pt-AO')} Kz</Text>
                  ) : null}
                </View>
              </View>
              <View style={s.procActions}>
                <TouchableOpacity onPress={() => abrirEditar(item)} style={s.actionBtn}>
                  <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {item.id && (
                  <TouchableOpacity onPress={() => excluir(item.id!)} style={s.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.center}>
            <Ionicons name="clipboard-outline" size={48} color={COLORS.textSecondary} />
            <Text style={s.emptyText}>Nenhum procedimento no plano</Text>
            <Text style={s.emptySubText}>Toque em + para adicionar</Text>
          </View>
        }
        contentContainerStyle={[{ paddingBottom: 120 }, isWeb && s.webContent]}
      />

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={abrirNovo}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal de Procedimento */}
      <Modal visible={modal} transparent animationType={isWeb ? 'fade' : 'slide'} onRequestClose={() => setModal(false)}>
        <View style={[s.modalOverlay, isWeb && s.modalOverlayWeb]}>
          <ScrollView
            style={[s.modalBox, isWeb && s.modalBoxWeb]}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editando.id ? 'Editar' : 'Novo'} Procedimento</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Sugestões rápidas */}
            <TouchableOpacity style={s.sugestaoToggle} onPress={() => setShowSugestoes(!showSugestoes)}>
              <Ionicons name="flash-outline" size={16} color={COLORS.primary} />
              <Text style={s.sugestaoToggleText}>Procedimentos frequentes</Text>
              <Ionicons name={showSugestoes ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
            </TouchableOpacity>

            {showSugestoes && (
              <View style={s.sugestoesBox}>
                {PROCEDIMENTOS_COMUNS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={s.sugestaoChip}
                    onPress={() => { setEditando((prev) => ({ ...prev, descricao: p })); setShowSugestoes(false); }}
                  >
                    <Text style={s.sugestaoChipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={s.label}>Procedimento *</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: Tratamento de canal, Extração..."
              placeholderTextColor={COLORS.textSecondary}
              value={editando.descricao}
              onChangeText={(v) => setEditando((p) => ({ ...p, descricao: v }))}
            />

            <Text style={s.label}>Dente(s)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: 16, 17 / Superior direito"
              placeholderTextColor={COLORS.textSecondary}
              value={editando.dente}
              onChangeText={(v) => setEditando((p) => ({ ...p, dente: v }))}
            />

            <Text style={s.label}>Valor estimado (Kz)</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Ex: 15000"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="numeric"
              value={editando.valor}
              onChangeText={(v) => setEditando((p) => ({ ...p, valor: v }))}
            />

            <Text style={s.label}>Estado</Text>
            <View style={s.statusRow}>
              {Object.entries(STATUS_PROC).map(([key, info]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusChip, editando.status === key && { backgroundColor: info.cor, borderColor: info.cor }]}
                  onPress={() => setEditando((p) => ({ ...p, status: key as any }))}
                >
                  <Text style={[s.statusChipText, editando.status === key && { color: 'white' }]}>{info.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[s.btnSalvar, salvando && { opacity: 0.6 }]} onPress={salvarProcedimento} disabled={salvando}>
              {salvando
                ? <ActivityIndicator color="white" />
                : <><Ionicons name="save-outline" size={18} color="white" /><Text style={s.btnSalvarText}>Guardar</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: SIZES.fontLg, color: COLORS.textSecondary },
  emptySubText: { marginTop: 4, fontSize: SIZES.fontSm, color: COLORS.textSecondary },

  resumo: { backgroundColor: COLORS.primary, padding: SIZES.md },
  resumoEyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: SIZES.fontXs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  resumoTitle: { color: 'white', fontWeight: '700', fontSize: SIZES.fontMd, marginBottom: SIZES.sm },
  resumoSubTitle: { color: 'rgba(255,255,255,0.86)', fontSize: SIZES.fontSm, marginBottom: SIZES.md, lineHeight: 20 },
  resumoRow: { flexDirection: 'row', gap: SIZES.sm },
  resumoCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: SIZES.radiusMd, padding: SIZES.sm, alignItems: 'center' },
  resumoNum: { color: 'white', fontSize: 22, fontWeight: '800' },
  resumoLabel: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.fontXs, marginTop: 2, textAlign: 'center' },
  pago: { color: 'rgba(255,255,255,0.9)', fontSize: SIZES.fontSm, marginTop: SIZES.sm },

  procCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    margin: SIZES.sm, marginBottom: 0, borderRadius: SIZES.radiusMd, padding: SIZES.md, ...SHADOWS.sm,
  },
  procStatus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: SIZES.sm },
  procInfo: { flex: 1 },
  procDesc: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text },
  procMeta: { fontSize: SIZES.fontXs, color: COLORS.textSecondary, marginTop: 2 },
  procFooter: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: 6 },
  procStatusBadge: { borderRadius: SIZES.radiusFull, paddingHorizontal: 8, paddingVertical: 3 },
  procStatusText: { fontSize: SIZES.fontXs, fontWeight: '700' },
  procValor: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.text },
  procActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
  },

  // Web layout
  webContent: { maxWidth: 900, width: '100%', alignSelf: 'center' as const },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalOverlayWeb: { justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SIZES.lg, maxHeight: '90%' },
  modalBoxWeb: { borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  modalTitle: { fontSize: SIZES.fontLg, fontWeight: '800', color: COLORS.text },
  modalInput: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SIZES.sm,
  },
  label: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
  statusChip: {
    borderRadius: SIZES.radiusFull, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  statusChipText: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary },

  sugestaoToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SIZES.sm,
    backgroundColor: '#EEF2FF', padding: SIZES.sm, borderRadius: SIZES.radiusMd,
  },
  sugestaoToggleText: { flex: 1, color: COLORS.primary, fontWeight: '600', fontSize: SIZES.fontSm },
  sugestoesBox: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
  sugestaoChip: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusFull,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  sugestaoChipText: { fontSize: SIZES.fontXs, color: COLORS.text },

  btnSalvar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, borderRadius: SIZES.radiusMd, paddingVertical: 14,
  },
  btnSalvarText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontMd },
});

export default PlanoTratamentoScreen;
