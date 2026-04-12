import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDateTime } from '../../utils/helpers';

type Props = NativeStackScreenProps<DentistaStackParamList, 'EvolucaoClinica'>;

interface Evolucao {
  id: string;
  descricao: string;
  procedimento_realizado: string;
  observacoes: string;
  created_at: string;
  dentista?: { nome: string };
}

interface EvolucaoForm {
  descricao: string;
  procedimento_realizado: string;
  observacoes: string;
}

const FORM_VAZIO: EvolucaoForm = { descricao: '', procedimento_realizado: '', observacoes: '' };

const PROCEDIMENTOS_RAPIDOS = [
  'Consulta de avaliação', 'Profilaxia / Limpeza', 'Restauração compósito',
  'Extração simples', 'Tratamento de canal — sessão 1', 'Tratamento de canal — sessão 2',
  'Aplicação de flúor', 'Radiografia', 'Ajuste de aparelho', 'Retorno pós-operatório',
];

const EvolucaoClinicaScreen: React.FC<Props> = ({ route, navigation }) => {
  const { triagemId, pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<EvolucaoForm>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [showRapidos, setShowRapidos] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('evolucoes_clinicas')
      .select('*, dentista:dentista_id(nome)')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(50);
    setEvolucoes((data || []) as Evolucao[]);
    setLoading(false);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  const set = (field: keyof EvolucaoForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const salvar = async () => {
    if (!form.descricao.trim()) {
      Toast.show({ type: 'error', text1: 'Descreva a evolução clínica' });
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from('evolucoes_clinicas').insert({
      paciente_id: pacienteId,
      dentista_id: profile?.id,
      triagem_id: triagemId,
      descricao: form.descricao.trim(),
      procedimento_realizado: form.procedimento_realizado.trim(),
      observacoes: form.observacoes.trim(),
    });
    setSalvando(false);
    if (error) {
      Toast.show({ type: 'error', text1: 'Erro ao guardar', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Evolução registada!', text2: 'Histórico clínico atualizado' });
      setModal(false);
      setForm(FORM_VAZIO);
      setShowRapidos(false);
      carregar();
    }
  };

  const excluir = (id: string) => {
    const confirmar = () =>
      supabase.from('evolucoes_clinicas').delete().eq('id', id).then(() => carregar());
    if (isWeb) {
      if (window.confirm('Remover este registo de evolução?')) confirmar();
    } else {
      Alert.alert('Remover', 'Deseja remover este registo?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: confirmar },
      ]);
    }
  };

  const renderItem = ({ item }: { item: Evolucao }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIconBox}>
          <Ionicons name="clipboard" size={18} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardData}>{formatDateTime(item.created_at)}</Text>
          {item.dentista?.nome ? (
            <Text style={s.cardDentista}>Dr(a). {item.dentista.nome}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => excluir(item.id)} style={s.deleteBtn}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <Text style={s.cardDescLabel}>Evolução</Text>
      <Text style={s.cardDescText}>{item.descricao}</Text>

      {item.procedimento_realizado ? (
        <>
          <Text style={s.cardDescLabel}>Procedimento realizado</Text>
          <View style={s.procBadge}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.secondary} />
            <Text style={s.procBadgeText}>{item.procedimento_realizado}</Text>
          </View>
        </>
      ) : null}

      {item.observacoes ? (
        <>
          <Text style={s.cardDescLabel}>Observações</Text>
          <Text style={s.cardObsText}>{item.observacoes}</Text>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={s.container}>
      {/* Header banner */}
      <View style={s.banner}>
        <Ionicons name="clipboard-outline" size={22} color="white" />
        <View style={{ flex: 1 }}>
          <Text style={s.bannerTitle}>Evoluções Clínicas</Text>
          <Text style={s.bannerSub}>{pacienteNome || 'Paciente'} · {evolucoes.length} registo{evolucoes.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.bannerBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      ) : (
        <FlatList
          data={evolucoes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.listContent, isWeb && s.webContent]}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="clipboard-outline" size={56} color={COLORS.textSecondary} />
              <Text style={s.emptyTitle}>Sem evoluções registadas</Text>
              <Text style={s.emptySubtitle}>Toque em + para registar a primeira evolução</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setModal(true)}>
                <Ionicons name="add-circle-outline" size={18} color="white" />
                <Text style={s.emptyBtnText}>Registar Evolução</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* FAB */}
      {!loading && evolucoes.length > 0 && (
        <TouchableOpacity style={s.fab} onPress={() => setModal(true)}>
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      )}

      {/* Modal de nova evolução */}
      <Modal
        visible={modal}
        transparent
        animationType={isWeb ? 'fade' : 'slide'}
        onRequestClose={() => setModal(false)}
      >
        <View style={[s.modalOverlay, isWeb && s.modalOverlayWeb]}>
          <ScrollView
            style={[s.modalBox, isWeb && s.modalBoxWeb]}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nova Evolução</Text>
              <TouchableOpacity onPress={() => { setModal(false); setForm(FORM_VAZIO); setShowRapidos(false); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Atalhos de procedimentos */}
            <TouchableOpacity style={s.rapidosToggle} onPress={() => setShowRapidos(!showRapidos)}>
              <Ionicons name="flash-outline" size={16} color={COLORS.secondary} />
              <Text style={s.rapidosToggleText}>Procedimentos frequentes</Text>
              <Ionicons name={showRapidos ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.secondary} />
            </TouchableOpacity>

            {showRapidos && (
              <View style={s.rapidosBox}>
                {PROCEDIMENTOS_RAPIDOS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={s.rapidoChip}
                    onPress={() => { set('procedimento_realizado', p); setShowRapidos(false); }}
                  >
                    <Text style={s.rapidoChipText}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={s.fieldLabel}>Evolução clínica *</Text>
            <TextInput
              style={s.textArea}
              placeholder="Descreva o estado clínico do paciente nesta sessão, achados, progressos..."
              placeholderTextColor={COLORS.textSecondary}
              value={form.descricao}
              onChangeText={(v) => set('descricao', v)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={s.fieldLabel}>Procedimento realizado</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: Restauração do dente 16, Extração do siso..."
              placeholderTextColor={COLORS.textSecondary}
              value={form.procedimento_realizado}
              onChangeText={(v) => set('procedimento_realizado', v)}
            />

            <Text style={s.fieldLabel}>Observações internas</Text>
            <TextInput
              style={s.textArea}
              placeholder="Notas para próxima sessão, instruções para o paciente..."
              placeholderTextColor={COLORS.textSecondary}
              value={form.observacoes}
              onChangeText={(v) => set('observacoes', v)}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[s.btnSalvar, salvando && { opacity: 0.6 }]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator color="white" />
                : <>
                    <Ionicons name="save-outline" size={20} color="white" />
                    <Text style={s.btnSalvarText}>Guardar Evolução</Text>
                  </>
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

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.secondary, padding: SIZES.md,
  },
  bannerTitle: { color: 'white', fontWeight: '700', fontSize: SIZES.fontLg },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.fontSm, marginTop: 2 },
  bannerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  listContent: { paddingBottom: 100, paddingTop: SIZES.sm },
  webContent: { maxWidth: 860, width: '100%', alignSelf: 'center' as const },

  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd,
    marginHorizontal: SIZES.md, marginBottom: SIZES.sm,
    padding: SIZES.md, ...SHADOWS.sm,
    borderLeftWidth: 4, borderLeftColor: COLORS.secondary,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
  cardIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.secondary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  cardData: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.text },
  cardDentista: { fontSize: SIZES.fontXs, color: COLORS.textSecondary },
  deleteBtn: { padding: 4 },

  cardDescLabel: {
    fontSize: SIZES.fontXs, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SIZES.sm, marginBottom: 4,
  },
  cardDescText: { fontSize: SIZES.fontMd, color: COLORS.text, lineHeight: 22 },
  procBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary + '15', borderRadius: SIZES.radiusFull,
    paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start',
  },
  procBadgeText: { fontSize: SIZES.fontSm, color: COLORS.secondary, fontWeight: '600' },
  cardObsText: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, fontStyle: 'italic' },

  emptyTitle: { marginTop: 12, fontSize: SIZES.fontLg, fontWeight: '600', color: COLORS.textSecondary },
  emptySubtitle: { marginTop: 4, fontSize: SIZES.fontSm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: SIZES.lg, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary, borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm,
  },
  emptyBtnText: { color: 'white', fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: 28, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalOverlayWeb: { justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SIZES.lg, maxHeight: '90%',
  },
  modalBoxWeb: { borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  modalTitle: { fontSize: SIZES.fontLg, fontWeight: '800', color: COLORS.text },

  rapidosToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary + '12', padding: SIZES.sm,
    borderRadius: SIZES.radiusMd, marginBottom: SIZES.sm,
  },
  rapidosToggleText: { flex: 1, color: COLORS.secondary, fontWeight: '600', fontSize: SIZES.fontSm },
  rapidosBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SIZES.md },
  rapidoChip: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusFull,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  rapidoChipText: { fontSize: SIZES.fontXs, color: COLORS.text },

  fieldLabel: {
    fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary,
    marginBottom: 4, marginTop: SIZES.sm,
  },
  input: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SIZES.sm,
  },
  textArea: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text,
    minHeight: 90, borderWidth: 1, borderColor: COLORS.border,
    textAlignVertical: 'top', marginBottom: SIZES.sm,
  },
  btnSalvar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, borderRadius: SIZES.radiusMd, paddingVertical: 15, marginTop: SIZES.md,
  },
  btnSalvarText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontMd },
});

export default EvolucaoClinicaScreen;
