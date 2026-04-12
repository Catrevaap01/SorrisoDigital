import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, FlatList, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

type Props = NativeStackScreenProps<DentistaStackParamList, 'Prescricao'>;

interface Medicamento {
  nome: string; dose: string; frequencia: string; duracao: string; via: string; observacoes: string;
}

const VIAS = ['Oral', 'Tópica', 'Injetável', 'Sublingual'];
const FREQUENCIAS = ['1x ao dia', '2x ao dia', '3x ao dia', 'De 6 em 6h', 'De 8 em 8h', 'De 12 em 12h', 'Quando necessário'];
const DURACOES = ['1 dia', '3 dias', '5 dias', '7 dias', '10 dias', '14 dias', 'Uso contínuo'];

const MEDS_COMUNS = [
  { nome: 'Amoxicilina 500mg',  dose: '500mg', frequencia: 'De 8 em 8h',  duracao: '7 dias',  via: 'Oral', observacoes: '' },
  { nome: 'Metronidazol 250mg', dose: '250mg', frequencia: 'De 8 em 8h',  duracao: '7 dias',  via: 'Oral', observacoes: '' },
  { nome: 'Ibuprofeno 400mg',   dose: '400mg', frequencia: 'De 8 em 8h',  duracao: '5 dias',  via: 'Oral', observacoes: 'Tomar após refeição' },
  { nome: 'Paracetamol 500mg',  dose: '500mg', frequencia: 'De 6 em 6h',  duracao: '3 dias',  via: 'Oral', observacoes: '' },
  { nome: 'Diclofenaco 50mg',   dose: '50mg',  frequencia: '2x ao dia',   duracao: '5 dias',  via: 'Oral', observacoes: '' },
  { nome: 'Clorexidina 0,12%',  dose: '15ml',  frequencia: '2x ao dia',   duracao: '7 dias',  via: 'Tópica', observacoes: 'Bochecho por 1 min' },
];
const MED_VAZIO: Medicamento = { nome: '', dose: '', frequencia: '2x ao dia', duracao: '7 dias', via: 'Oral', observacoes: '' };

const PrescricaoScreen: React.FC<Props> = ({ route, navigation }) => {
  const { triagemId, pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const isWeb = Platform.OS === 'web';
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([{ ...MED_VAZIO }]);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [aba, setAba] = useState<'nova' | 'historico'>('nova');

  useEffect(() => {
    supabase.from('prescricoes').select('*')
      .eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setHistorico(data || []));
  }, [pacienteId]);

  const setMed = (i: number, field: keyof Medicamento, v: string) =>
    setMedicamentos((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: v } : m));

  const salvar = async () => {
    const validos = medicamentos.filter((m) => m.nome.trim());
    if (!validos.length) { Toast.show({ type: 'error', text1: 'Adicione pelo menos um medicamento' }); return; }
    setSalvando(true);
    const { error } = await supabase.from('prescricoes').insert({
      paciente_id: pacienteId, dentista_id: profile?.id, triagem_id: triagemId,
      medicamentos: validos, observacoes,
      dentista_nome: profile?.nome,
      dentista_crm: (profile as any)?.crm || (profile as any)?.numero_registro || '',
    });
    setSalvando(false);
    if (error) {
      Toast.show({ type: 'error', text1: 'Erro', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Prescrição emitida!' });
      navigation.goBack();
    }
  };

  const SelectRow = ({ label, opts, val, onChange }: { label: string; opts: string[]; val: string; onChange: (v: string) => void }) => (
    <View style={s.selectGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {opts.map((o) => (
            <TouchableOpacity key={o} style={[s.chip, val === o && s.chipActive]} onPress={() => onChange(o)}>
              <Text style={[s.chipText, val === o && { color: 'white' }]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="medical" size={22} color="white" />
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Prescrição</Text>
          <Text style={s.headerSub}>Dr(a). {profile?.nome} · {pacienteNome}</Text>
        </View>
      </View>

      <View style={s.tabs}>
        {(['nova', 'historico'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tab, aba === t && s.tabActive]} onPress={() => setAba(t)}>
            <Text style={[s.tabText, aba === t && s.tabTextActive]}>
              {t === 'nova' ? 'Nova Prescrição' : `Histórico (${historico.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {aba === 'nova' ? (
        <ScrollView contentContainerStyle={[s.content, isWeb && s.webContent]}>
          <Text style={s.sectionTitle}>Atalhos frequentes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {MEDS_COMUNS.map((med) => (
                <TouchableOpacity key={med.nome} style={s.atalho}
                  onPress={() => setMedicamentos((prev) => [...prev.filter((m) => m.nome.trim()), { ...med }])}>
                  <Ionicons name="add-circle-outline" size={13} color={COLORS.primary} />
                  <Text style={s.atalhoText}>{med.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {medicamentos.map((med, i) => (
            <View key={i} style={s.medCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={s.medTitle}>Medicamento {i + 1}</Text>
                {medicamentos.length > 1 && (
                  <TouchableOpacity onPress={() => setMedicamentos((p) => p.filter((_, idx) => idx !== i))}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.fieldLabel}>Nome *</Text>
              <TextInput style={s.input} placeholder="Ex: Amoxicilina 500mg"
                placeholderTextColor={COLORS.textSecondary} value={med.nome} onChangeText={(v) => setMed(i, 'nome', v)} />
              <Text style={s.fieldLabel}>Dose</Text>
              <TextInput style={s.input} placeholder="Ex: 1 comprimido, 500mg"
                placeholderTextColor={COLORS.textSecondary} value={med.dose} onChangeText={(v) => setMed(i, 'dose', v)} />
              <SelectRow label="Via" opts={VIAS} val={med.via} onChange={(v) => setMed(i, 'via', v)} />
              <SelectRow label="Frequência" opts={FREQUENCIAS} val={med.frequencia} onChange={(v) => setMed(i, 'frequencia', v)} />
              <SelectRow label="Duração" opts={DURACOES} val={med.duracao} onChange={(v) => setMed(i, 'duracao', v)} />
              <Text style={s.fieldLabel}>Observações</Text>
              <TextInput style={s.input} placeholder="Ex: Tomar após refeição"
                placeholderTextColor={COLORS.textSecondary} value={med.observacoes} onChangeText={(v) => setMed(i, 'observacoes', v)} />
            </View>
          ))}

          <TouchableOpacity style={s.addBtn} onPress={() => setMedicamentos((p) => [...p, { ...MED_VAZIO }])}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
            <Text style={s.addBtnText}>Adicionar medicamento</Text>
          </TouchableOpacity>

          <Text style={s.fieldLabel}>Observações gerais</Text>
          <TextInput style={s.textArea} placeholder="Instruções gerais ao paciente..."
            placeholderTextColor={COLORS.textSecondary} value={observacoes} onChangeText={setObservacoes}
            multiline numberOfLines={3} textAlignVertical="top" />

          <View style={s.rodape}>
            <Text style={s.rodapeText}>
              Dr(a). {profile?.nome} · CRM: {(profile as any)?.crm || (profile as any)?.numero_registro || '—'}{'\n'}
              Válido apenas com assinatura e carimbo do profissional.
            </Text>
          </View>

          <TouchableOpacity style={[s.btnEmitir, salvando && { opacity: 0.6 }]} onPress={salvar} disabled={salvando}>
            {salvando ? <ActivityIndicator color="white" />
              : <><Ionicons name="document-text-outline" size={20} color="white" /><Text style={s.btnEmitirText}>Emitir Prescrição</Text></>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <FlatList
          data={historico}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[{ padding: SIZES.md, paddingBottom: 40 }, isWeb && s.webContent]}
          ListEmptyComponent={<View style={s.center}><Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} /><Text style={s.emptyText}>Sem prescrições anteriores</Text></View>}
          renderItem={({ item }) => {
            const meds: Medicamento[] = item.medicamentos || [];
            return (
              <View style={s.histCard}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <Ionicons name="document-text" size={16} color={COLORS.primary} />
                  <Text style={{ fontWeight: '700', color: COLORS.text, fontSize: SIZES.fontSm }}>
                    {new Date(item.created_at).toLocaleDateString('pt-AO')}
                  </Text>
                  <Text style={{ flex: 1, textAlign: 'right', fontSize: SIZES.fontXs, color: COLORS.textSecondary }}>
                    Dr(a). {item.dentista_nome}
                  </Text>
                </View>
                {meds.map((m, i) => (
                  <Text key={i} style={s.histMed}>• <Text style={{ fontWeight: '700' }}>{m.nome}</Text> {m.dose} · {m.frequencia} · {m.duracao}</Text>
                ))}
                {item.observacoes ? <Text style={s.histObs}>{item.observacoes}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  webContent: { maxWidth: 860, width: '100%', alignSelf: 'center' as const },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#E91E63', padding: SIZES.md },
  headerTitle: { color: 'white', fontWeight: '700', fontSize: SIZES.fontLg },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.fontSm },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#E91E63' },
  tabText: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: '#E91E63' },
  content: { padding: SIZES.md },
  sectionTitle: { fontSize: SIZES.fontXs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
  atalho: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusFull, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  atalhoText: { fontSize: SIZES.fontXs, color: COLORS.text },
  medCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md, ...SHADOWS.sm, borderLeftWidth: 4, borderLeftColor: '#E91E63' },
  medTitle: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text },
  fieldLabel: { fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: COLORS.background, borderRadius: SIZES.radiusMd, padding: SIZES.sm, fontSize: SIZES.fontMd, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  textArea: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd, padding: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text, minHeight: 80, borderWidth: 1, borderColor: COLORS.border, marginBottom: SIZES.md },
  selectGroup: { marginTop: 4 },
  chip: { borderRadius: SIZES.radiusFull, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background },
  chipActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  chipText: { fontSize: SIZES.fontXs, fontWeight: '600', color: COLORS.textSecondary },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
  addBtnText: { color: COLORS.primary, fontWeight: '700' },
  rodape: { backgroundColor: '#FFF3E0', borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md, borderWidth: 1, borderColor: '#FFE0B2' },
  rodapeText: { fontSize: SIZES.fontSm, color: '#E65100', textAlign: 'center', lineHeight: 20 },
  btnEmitir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E91E63', borderRadius: SIZES.radiusMd, paddingVertical: 16, marginBottom: 8 },
  btnEmitirText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontLg },
  emptyText: { marginTop: 12, color: COLORS.textSecondary },
  histCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm, ...SHADOWS.sm },
  histMed: { fontSize: SIZES.fontSm, color: COLORS.text, marginBottom: 4 },
  histObs: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginTop: SIZES.sm, fontStyle: 'italic' },
});

export default PrescricaoScreen;
