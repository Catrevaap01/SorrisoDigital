import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Switch, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

type Props = NativeStackScreenProps<DentistaStackParamList, 'Anamnese'>;

interface AnamneseData {
  queixa_principal: string;
  hda: string; // História da Doença Atual
  // Antecedentes
  alergico: boolean;
  alergias_desc: string;
  em_tratamento: boolean;
  tratamento_desc: string;
  medicamentos: string;
  // Doenças sistémicas
  hipertensao: boolean;
  diabetes: boolean;
  cardiopatia: boolean;
  coagulopatia: boolean;
  hepatite: boolean;
  hiv: boolean;
  outras_doencas: string;
  // Hábitos
  fuma: boolean;
  alcool: boolean;
  // Feminino
  gravida: boolean;
  amamentando: boolean;
  // Saúde oral
  ultima_consulta: string;
  escovacoes_dia: string;
  usa_fio_dental: boolean;
  observacoes: string;
}

const INICIAL: AnamneseData = {
  queixa_principal: '', hda: '',
  alergico: false, alergias_desc: '', em_tratamento: false, tratamento_desc: '',
  medicamentos: '', hipertensao: false, diabetes: false, cardiopatia: false,
  coagulopatia: false, hepatite: false, hiv: false, outras_doencas: '',
  fuma: false, alcool: false, gravida: false, amamentando: false,
  ultima_consulta: '', escovacoes_dia: '2', usa_fio_dental: false, observacoes: '',
};

const AnamneseScreen: React.FC<Props> = ({ route, navigation }) => {
  const { triagemId, pacienteId, pacienteNome } = route.params;
  const { profile } = useAuth();
  const [dados, setDados] = useState<AnamneseData>(INICIAL);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Carregar anamnese existente
    (async () => {
      const { data } = await supabase
        .from('anamneses')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .maybeSingle();
      if (data) {
        setDados({ ...INICIAL, ...data });
      }
      setLoading(false);
    })();
  }, [pacienteId]);

  const set = (field: keyof AnamneseData, value: any) =>
    setDados((prev) => ({ ...prev, [field]: value }));

  const salvar = async () => {
    if (!dados.queixa_principal.trim()) {
      Toast.show({ type: 'error', text1: 'Preencha a queixa principal' });
      return;
    }
    setSalvando(true);
    const payload = {
      ...dados,
      paciente_id: pacienteId,
      dentista_id: profile?.id,
      triagem_id: triagemId,
      updated_at: new Date().toISOString(),
    };

    // upsert — cria ou actualiza
    const { error } = await supabase.from('anamneses').upsert(payload, {
      onConflict: 'paciente_id',
    });

    setSalvando(false);
    if (error) {
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Anamnese salva!', text2: 'Registo clínico atualizado' });
      navigation.goBack();
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const SwitchRow = ({ label, field, descField }: { label: string; field: keyof AnamneseData; descField?: keyof AnamneseData }) => (
    <View style={s.switchRow}>
      <View style={s.switchLabelRow}>
        <Text style={s.switchLabel}>{label}</Text>
        <Switch
          value={!!dados[field]}
          onValueChange={(v) => set(field, v)}
          trackColor={{ true: COLORS.primary }}
          thumbColor={dados[field] ? COLORS.primaryDark : '#ccc'}
        />
      </View>
      {dados[field] && descField && (
        <TextInput
          style={s.inputSmall}
          placeholder="Descreva..."
          placeholderTextColor={COLORS.textSecondary}
          value={String(dados[descField] || '')}
          onChangeText={(v) => set(descField, v)}
        />
      )}
    </View>
  );

  const Section = ({ title, icon }: { title: string; icon: string }) => (
    <View style={s.sectionHeader}>
      <Ionicons name={icon as any} size={18} color={COLORS.primary} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[
        s.content,
        Platform.OS === 'web' && s.webContent,
      ]}
    >
      {/* Banner */}
      <View style={s.banner}>
        <Ionicons name="document-text" size={22} color="white" />
        <Text style={s.bannerText}>Anamnese de {pacienteNome || 'Paciente'}</Text>
      </View>

      {/* Queixa Principal */}
      <Section title="Queixa Principal" icon="chatbubble-outline" />
      <TextInput
        style={s.textArea}
        placeholder="Descreva a queixa principal do paciente..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.queixa_principal}
        onChangeText={(v) => set('queixa_principal', v)}
        multiline numberOfLines={3} textAlignVertical="top"
      />

      <Section title="História da Doença Atual (HDA)" icon="time-outline" />
      <TextInput
        style={s.textArea}
        placeholder="Quando iniciou, evolução, fatores de melhora/piora..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.hda}
        onChangeText={(v) => set('hda', v)}
        multiline numberOfLines={3} textAlignVertical="top"
      />

      {/* Antecedentes */}
      <Section title="Antecedentes Médicos" icon="medical-outline" />
      <SwitchRow label="Alérgico(a)" field="alergico" descField="alergias_desc" />
      <SwitchRow label="Em tratamento médico" field="em_tratamento" descField="tratamento_desc" />

      <Text style={s.fieldLabel}>Medicamentos em uso</Text>
      <TextInput
        style={s.input}
        placeholder="Ex: Paracetamol 500mg, Ibuprofeno..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.medicamentos}
        onChangeText={(v) => set('medicamentos', v)}
      />

      {/* Doenças Sistémicas */}
      <Section title="Doenças Sistémicas" icon="fitness-outline" />
      <View style={s.doencasGrid}>
        {([
          ['hipertensao', 'Hipertensão'],
          ['diabetes', 'Diabetes'],
          ['cardiopatia', 'Cardiopatia'],
          ['coagulopatia', 'Coagulopatia'],
          ['hepatite', 'Hepatite / HBV'],
          ['hiv', 'HIV / SIDA'],
        ] as const).map(([field, label]) => (
          <TouchableOpacity
            key={field}
            style={[s.doencaChip, dados[field] && s.doencaChipActive]}
            onPress={() => set(field, !dados[field])}
          >
            <Ionicons
              name={dados[field] ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={dados[field] ? 'white' : COLORS.textSecondary}
            />
            <Text style={[s.doencaChipText, dados[field] && { color: 'white' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.fieldLabel}>Outras doenças</Text>
      <TextInput
        style={s.input}
        placeholder="Especifique outras condições..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.outras_doencas}
        onChangeText={(v) => set('outras_doencas', v)}
      />

      {/* Hábitos */}
      <Section title="Hábitos" icon="leaf-outline" />
      <SwitchRow label="Fuma" field="fuma" />
      <SwitchRow label="Consome álcool" field="alcool" />
      <SwitchRow label="Grávida" field="gravida" />
      <SwitchRow label="Amamentando" field="amamentando" />

      {/* Saúde Oral */}
      <Section title="Saúde Oral" icon="happy-outline" />
      <Text style={s.fieldLabel}>Última consulta dentária</Text>
      <TextInput
        style={s.input}
        placeholder="Ex: Há 6 meses, nunca foi..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.ultima_consulta}
        onChangeText={(v) => set('ultima_consulta', v)}
      />

      <Text style={s.fieldLabel}>Escovações por dia</Text>
      <View style={s.escovRow}>
        {['1', '2', '3', '4+'].map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.escovBtn, dados.escovacoes_dia === n && s.escovBtnActive]}
            onPress={() => set('escovacoes_dia', n)}
          >
            <Text style={[s.escovBtnText, dados.escovacoes_dia === n && { color: 'white' }]}>{n}x</Text>
          </TouchableOpacity>
        ))}
      </View>
      <SwitchRow label="Usa fio dental diariamente" field="usa_fio_dental" />

      {/* Observações */}
      <Section title="Observações do Dentista" icon="create-outline" />
      <TextInput
        style={s.textArea}
        placeholder="Notas clínicas adicionais..."
        placeholderTextColor={COLORS.textSecondary}
        value={dados.observacoes}
        onChangeText={(v) => set('observacoes', v)}
        multiline numberOfLines={3} textAlignVertical="top"
      />

      {/* Botão Salvar */}
      <TouchableOpacity
        style={[s.btnSalvar, salvando && { opacity: 0.6 }]}
        onPress={salvar}
        disabled={salvando}
      >
        {salvando
          ? <ActivityIndicator color="white" />
          : <>
              <Ionicons name="save-outline" size={20} color="white" />
              <Text style={s.btnSalvarText}>Guardar Anamnese</Text>
            </>
        }
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },
  webContent: { maxWidth: 860, width: '100%', alignSelf: 'center' as const },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.primary, padding: SIZES.md,
  },
  bannerText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontLg },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, paddingHorizontal: SIZES.md,
    paddingVertical: 10, marginTop: SIZES.sm, borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  sectionTitle: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text },

  textArea: {
    margin: SIZES.md, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text,
    minHeight: 85, borderWidth: 1, borderColor: COLORS.border, textAlignVertical: 'top',
  },
  input: {
    marginHorizontal: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd, padding: SIZES.md, fontSize: SIZES.fontMd,
    color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  inputSmall: {
    marginTop: 6, backgroundColor: COLORS.background, borderRadius: SIZES.radiusSm,
    padding: SIZES.sm, fontSize: SIZES.fontSm, color: COLORS.text,
    borderWidth: 1, borderColor: COLORS.border,
  },
  fieldLabel: {
    marginHorizontal: SIZES.md, marginTop: SIZES.sm, marginBottom: 4,
    fontSize: SIZES.fontSm, fontWeight: '600', color: COLORS.textSecondary,
  },

  switchRow: {
    marginHorizontal: SIZES.md, marginBottom: SIZES.sm,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd,
    padding: SIZES.md, ...SHADOWS.sm,
  },
  switchLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: SIZES.fontMd, color: COLORS.text, fontWeight: '500', flex: 1 },

  doencasGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm,
    paddingHorizontal: SIZES.md, marginBottom: SIZES.sm,
  },
  doencaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusFull,
    paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  doencaChipActive: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  doencaChipText: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, fontWeight: '600' },

  escovRow: { flexDirection: 'row', gap: SIZES.sm, paddingHorizontal: SIZES.md, marginBottom: SIZES.sm },
  escovBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.border,
  },
  escovBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  escovBtnText: { fontWeight: '700', color: COLORS.textSecondary },

  btnSalvar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.secondary, margin: SIZES.md,
    borderRadius: SIZES.radiusMd, paddingVertical: 16,
  },
  btnSalvarText: { color: 'white', fontWeight: '700', fontSize: SIZES.fontLg },
});

export default AnamneseScreen;
