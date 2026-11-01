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
  const { triagemId, pacienteId: initialPacienteId, pacienteNome: initialNome } = route.params || {};
  const { profile } = useAuth();
  const isWeb = Platform.OS === 'web';

  const [pacienteIdAtual, setPacienteIdAtual] = useState<string>(initialPacienteId || '');
  const [pacienteNome, setPacienteNome] = useState(initialNome || 'Selecione um paciente');
  const [triagemIdAtual, setTriagemIdAtual] = useState<string | null>(triagemId || null);

  const [pacientesAtribuidos, setPacientesAtribuidos] = useState<any[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [modalPacientes, setModalPacientes] = useState(false);
  const [buscaPaciente, setBuscaPaciente] = useState('');

  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<EvolucaoForm>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [showRapidos, setShowRapidos] = useState(false);

  // Carregar todos os pacientes atribuídos a este dentista
  const carregarPacientesAtribuidos = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingPacientes(true);
    try {
      const dentistaId = profile.id;
      const [resProfiles, resAppointments, resTriagens] = await Promise.all([
        supabase.from('profiles').select('id, nome, telefone').eq('dentist_id', dentistaId),
        supabase.from('appointments').select('patient_id, triagem_id, paciente:profiles!patient_id(id, nome, telefone)').eq('dentist_id', dentistaId).order('appointment_date', { ascending: false }),
        supabase.from('triagens').select('id, patient_id, paciente:profiles!patient_id(id, nome, telefone)').eq('dentist_id', dentistaId).order('created_at', { ascending: false }),
      ]);

      const map = new Map<string, { id: string; nome: string; telefone?: string; triagemId?: string }>();

      (resProfiles.data || []).forEach((p: any) => {
        if (p?.id) map.set(p.id, { id: p.id, nome: p.nome || 'Paciente', telefone: p.telefone });
      });

      (resAppointments.data || []).forEach((a: any) => {
        const pac = a.paciente;
        if (pac?.id && !map.has(pac.id)) {
          map.set(pac.id, { id: pac.id, nome: pac.nome || 'Paciente', telefone: pac.telefone, triagemId: a.triagem_id });
        }
      });

      (resTriagens.data || []).forEach((t: any) => {
        const pac = t.paciente;
        if (pac?.id && !map.has(pac.id)) {
          map.set(pac.id, { id: pac.id, nome: pac.nome || 'Paciente', telefone: pac.telefone, triagemId: t.id });
        }
      });

      const lista = Array.from(map.values());
      setPacientesAtribuidos(lista);

      // Se nenhum paciente foi selecionado na inicialização, seleciona o primeiro
      if (!pacienteIdAtual && lista.length > 0) {
        setPacienteIdAtual(lista[0].id);
        setPacienteNome(lista[0].nome);
        if (lista[0].triagemId) setTriagemIdAtual(lista[0].triagemId);
      }
    } catch (e) {
      console.warn('Erro ao carregar pacientes atribuídos:', e);
    } finally {
      setLoadingPacientes(false);
    }
  }, [profile?.id, pacienteIdAtual]);

  useEffect(() => {
    carregarPacientesAtribuidos();
  }, [carregarPacientesAtribuidos]);

  const carregar = useCallback(async () => {
    if (!pacienteIdAtual) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Buscar nome atualizado se for necessário
    if (!pacienteNome || pacienteNome === 'Paciente' || pacienteNome === 'Selecione um paciente') {
      supabase.from('profiles').select('nome').eq('id', pacienteIdAtual).maybeSingle().then(({ data }) => {
        if (data?.nome) setPacienteNome(data.nome);
      });
    }

    const { data } = await supabase
      .from('evolucoes_clinicas')
      .select('*, dentista:dentista_id(nome)')
      .eq('paciente_id', pacienteIdAtual)
      .order('created_at', { ascending: false })
      .limit(50);
    setEvolucoes((data || []) as Evolucao[]);
    setLoading(false);
  }, [pacienteIdAtual, pacienteNome]);

  useEffect(() => {
    if (pacienteIdAtual) {
      carregar();
    }
  }, [pacienteIdAtual, carregar]);

  const pacientesFiltrados = React.useMemo(() => {
    const termo = buscaPaciente.trim().toLowerCase();
    if (!termo) return pacientesAtribuidos;
    return pacientesAtribuidos.filter((p) =>
      p.nome?.toLowerCase().includes(termo) || p.telefone?.includes(termo)
    );
  }, [buscaPaciente, pacientesAtribuidos]);

  const selecionarPaciente = (p: { id: string; nome: string; triagemId?: string }) => {
    setPacienteIdAtual(p.id);
    setPacienteNome(p.nome);
    if (p.triagemId) setTriagemIdAtual(p.triagemId);
    setModalPacientes(false);
  };

  const set = (field: keyof EvolucaoForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const salvar = async () => {
    if (!pacienteIdAtual) {
      Toast.show({ type: 'error', text1: 'Selecione um paciente', text2: 'Escolha um paciente atribuído para registar a evolução.' });
      return;
    }
    if (!form.descricao.trim()) {
      Toast.show({ type: 'error', text1: 'Descreva a evolução clínica' });
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from('evolucoes_clinicas').insert({
      paciente_id: pacienteIdAtual,
      dentista_id: profile?.id,
      triagem_id: triagemIdAtual || null,
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
          <Text style={s.bannerTitle}>Evolução Clínica</Text>
          <Text style={s.bannerSub}>{pacienteNome || 'Paciente'} · {evolucoes.length} registo{evolucoes.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.bannerBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Barra de Seleção de Paciente Atribuído */}
      <View style={s.selectorBar}>
        <View style={s.selectorIconWrap}>
          <Ionicons name="person" size={18} color={COLORS.secondary} />
        </View>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={s.selectorLabel}>PACIENTE ATRIBUÍDO</Text>
          <Text style={s.selectorNome} numberOfLines={1}>{pacienteNome || 'Selecione um paciente'}</Text>
        </View>
        <TouchableOpacity
          style={s.btnTrocar}
          onPress={() => setModalPacientes(true)}
          activeOpacity={0.7}
        >
          <Text style={s.btnTrocarText}>Trocar</Text>
          <Ionicons name="chevron-down" size={14} color={COLORS.secondary} />
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
              <Text style={s.emptySubtitle}>
                {pacienteIdAtual
                  ? `Nenhuma evolução para ${pacienteNome}. Toque em + para registar.`
                  : 'Nenhum paciente selecionado. Escolha um paciente acima.'}
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => pacienteIdAtual ? setModal(true) : setModalPacientes(true)}>
                <Ionicons name={pacienteIdAtual ? "add-circle-outline" : "people-outline"} size={18} color="white" />
                <Text style={s.emptyBtnText}>
                  {pacienteIdAtual ? "Registar Evolução" : "Selecionar Paciente"}
                </Text>
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

      {/* Modal para seleção de paciente atribuído */}
      <Modal
        visible={modalPacientes}
        transparent
        animationType={isWeb ? 'fade' : 'slide'}
        onRequestClose={() => setModalPacientes(false)}
      >
        <View style={[s.modalOverlay, isWeb && s.modalOverlayWeb]}>
          <View style={[s.modalBox, isWeb && s.modalBoxWeb, { maxHeight: '80%' }]}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="people" size={22} color={COLORS.secondary} />
                <Text style={s.modalTitle}>Pacientes Atribuídos</Text>
              </View>
              <TouchableOpacity onPress={() => setModalPacientes(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
              <TextInput
                style={s.searchInput}
                placeholder="Pesquisar por nome ou telefone..."
                placeholderTextColor={COLORS.textLight}
                value={buscaPaciente}
                onChangeText={setBuscaPaciente}
              />
              {buscaPaciente.length > 0 && (
                <TouchableOpacity onPress={() => setBuscaPaciente('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {loadingPacientes ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={COLORS.secondary} />
                <Text style={{ marginTop: 8, color: COLORS.textSecondary, fontSize: 13 }}>Carregando pacientes...</Text>
              </View>
            ) : (
              <FlatList
                data={pacientesFiltrados}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingVertical: 8 }}
                renderItem={({ item }) => {
                  const isSelecionado = item.id === pacienteIdAtual;
                  return (
                    <TouchableOpacity
                      style={[s.itemPaciente, isSelecionado && s.itemPacienteSelecionado]}
                      onPress={() => selecionarPaciente(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.itemAvatar, isSelecionado && s.itemAvatarSelecionado]}>
                        <Text style={[s.itemAvatarText, isSelecionado && { color: 'white' }]}>
                          {(item.nome || 'P').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.itemPacienteNome, isSelecionado && { color: COLORS.secondary, fontWeight: '700' }]}>
                          {item.nome}
                        </Text>
                        {item.telefone ? (
                          <Text style={s.itemPacienteTel}>{item.telefone}</Text>
                        ) : null}
                      </View>
                      {isSelecionado ? (
                        <View style={s.badgeSelecionado}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.secondary} />
                          <Text style={s.badgeSelecionadoText}>Ativo</Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={COLORS.border} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 32, alignItems: 'center' }}>
                    <Ionicons name="person-outline" size={40} color={COLORS.textSecondary} />
                    <Text style={{ marginTop: 8, color: COLORS.textSecondary, fontWeight: '600' }}>
                      Nenhum paciente atribuído encontrado
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

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

            {/* Informação do Paciente Ativo */}
            <View style={s.modalPacienteInfo}>
              <Ionicons name="person-circle-outline" size={20} color={COLORS.secondary} />
              <View style={{ flex: 1 }}>
                <Text style={s.modalPacienteLabel}>Paciente:</Text>
                <Text style={s.modalPacienteNome}>{pacienteNome || 'Selecione um paciente'}</Text>
              </View>
              <TouchableOpacity
                style={s.modalTrocarBtn}
                onPress={() => { setModal(false); setModalPacientes(true); }}
              >
                <Text style={s.modalTrocarBtnText}>Alterar</Text>
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

  // Barra de Seleção de Paciente
  selectorBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: SIZES.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', ...SHADOWS.sm,
  },
  selectorIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.secondary + '18',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  selectorLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.5,
  },
  selectorNome: {
    fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text, marginTop: 1,
  },
  btnTrocar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.secondary + '12', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: SIZES.radiusFull, borderWidth: 1, borderColor: COLORS.secondary + '30',
  },
  btnTrocarText: {
    color: COLORS.secondary, fontSize: 13, fontWeight: '700',
  },

  // Modal Paciente Info
  modalPacienteInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.secondary + '10', padding: 12, borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.md, borderWidth: 1, borderColor: COLORS.secondary + '25',
  },
  modalPacienteLabel: { fontSize: 11, color: COLORS.textSecondary },
  modalPacienteNome: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  modalTrocarBtn: {
    backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  modalTrocarBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },

  // Lista de Pacientes
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F1F5F9', borderRadius: SIZES.radiusMd,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 4,
  },
  itemPaciente: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: SIZES.radiusMd,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  itemPacienteSelecionado: {
    backgroundColor: COLORS.secondary + '0C',
  },
  itemAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center',
  },
  itemAvatarSelecionado: {
    backgroundColor: COLORS.secondary,
  },
  itemAvatarText: {
    fontWeight: '700', fontSize: 16, color: COLORS.textSecondary,
  },
  itemPacienteNome: {
    fontSize: 15, fontWeight: '600', color: COLORS.text,
  },
  itemPacienteTel: {
    fontSize: 12, color: COLORS.textSecondary, marginTop: 2,
  },
  badgeSelecionado: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.secondary + '18', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSelecionadoText: {
    fontSize: 11, fontWeight: '700', color: COLORS.secondary,
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
