/**
 * CompleteProfileScreen.tsx
 *
 * Ecrã de onboarding obrigatório para pacientes auto-registados.
 * ✅ Compatível com: iOS · Android · Web · PWA
 *
 * Fluxo:
 *  1. Paciente regista-se → perfil sem telefone/provincia
 *  2. AppNavigator → CompleteProfileScreen (este ecrã)
 *  3. Paciente preenche → updateProfile() → telefone + provincia guardados
 *  4. AppNavigator → ChangePasswordScreen (senha_alterada=false)
 *  5. Acesso ao app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

// DateTimePicker — só existe em iOS/Android; em web usamos <input type="date">
let DateTimePicker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    DateTimePicker = require('@react-native-community/datetimepicker').default;
  } catch (_) {
    DateTimePicker = null;
  }
}

// ─── Dados ────────────────────────────────────────────────────────────────────

const PROVINCIAS = [
  'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cuando Cubango',
  'Cuanza Norte', 'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla',
  'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje', 'Moxico',
  'Namibe', 'Uíge', 'Zaire',
];

const GENEROS = ['Masculino', 'Feminino'];

type Step = 'dados' | 'localizacao';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mostra alerta — usa Toast (funciona em web/PWA/mobile) */
const showError = (title: string, message: string) => {
  Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 4000 });
};

// ─── Componente ───────────────────────────────────────────────────────────────

const CompleteProfileScreen: React.FC = () => {
  const { profile, updateProfile, user } = useAuth();

  const [step, setStep] = useState<Step>('dados');

  // Passo 1
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [dataNascimento, setDataNascimento] = useState(profile?.data_nascimento || '');
  const [genero, setGenero] = useState<string>(profile?.genero || '');
  const [showGenero, setShowGenero] = useState(false);

  // Calendário
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState<Date>(() => {
    if (profile?.data_nascimento) {
      const d = new Date(profile.data_nascimento);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(2000, 0, 1);
  });

  /** Converte Date → string DD/MM/AAAA */
  const dateToDisplay = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  /** Converte Date → string AAAA-MM-DD (formato ISO para BD) */
  const dateToISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Passo 2
  const [provincia, setProvincia] = useState(profile?.provincia || '');
  const [showProvincias, setShowProvincias] = useState(false);
  const [enderecoRua, setEnderecoRua] = useState(profile?.endereco_rua || '');

  const [saving, setSaving] = useState(false);

  // ── Validação Passo 1 ──────────────────────────────────────────────────────
  const validateStep1 = (): boolean => {
    if (!telefone.trim()) {
      showError('Campo obrigatório', 'Por favor insira o seu número de telefone.');
      return false;
    }
    if (telefone.replace(/\D/g, '').length < 9) {
      showError('Telefone inválido', 'Insira um número válido (mínimo 9 dígitos).');
      return false;
    }
    if (!dataNascimento.trim()) {
      showError('Campo obrigatório', 'Por favor insira a sua data de nascimento.');
      return false;
    }
    if (!genero.trim()) {
      showError('Campo obrigatório', 'Por favor selecione o seu género.');
      return false;
    }
    return true;
  };

  // ── Validação Passo 2 ──────────────────────────────────────────────────────
  const validateStep2 = (): boolean => {
    if (!provincia.trim()) {
      showError('Campo obrigatório', 'Por favor selecione a sua província.');
      return false;
    }
    return true;
  };

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        telefone: telefone.trim(),
        provincia: provincia.trim(),
        senha_alterada: false, // forçar mudança de senha a seguir
      };
      if (dataNascimento.trim()) updates.data_nascimento = dataNascimento.trim();
      if (genero) updates.genero = genero;
      if (enderecoRua.trim()) updates.endereco_rua = enderecoRua.trim();

      const result = await updateProfile(updates);
      if (!result.success) {
        const msg = (result.error as any)?.message || 'Tente novamente.';
        showError('Erro ao guardar', msg);
      }
      // AppNavigator redireciona automaticamente para ChangePassword
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers do calendário ────────────────────────────────────────────────
  /** Mobile: callback do DateTimePicker */
  const onDateChange = (_event: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS mantém aberto
    if (selected) {
      setDatePickerDate(selected);
      setDataNascimento(dateToISO(selected));
    } else if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  /** Web: handler do <input type="date"> nativo */
  const onWebDateChange = (e: any) => {
    const val: string = e?.target?.value || e?.nativeEvent?.text || '';
    if (val) {
      const d = new Date(val + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setDatePickerDate(d);
        setDataNascimento(val); // AAAA-MM-DD
      }
    }
  };

  // ── KAV behavior cross-platform ────────────────────────────────────────────
  const kavBehavior = Platform.select<'padding' | 'height' | 'position' | undefined>({
    ios: 'padding',
    android: 'height',
    default: undefined, // Web/PWA — browser trata o teclado
  });

  const rawName =
    profile?.nome ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';
  const firstName = rawName ? rawName.split(' ')[0] : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={kavBehavior}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="person-add" size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Completar Perfil</Text>
          <Text style={styles.subtitle}>
            {firstName ? `Olá, ${firstName}! 👋\n` : 'Olá! 👋\n'}
            Complete os seus dados para continuar.
          </Text>

          {/* Indicador de passos */}
          <View style={styles.stepsRow}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, step === 'dados' ? styles.stepDotActive : styles.stepDotDone]}>
                {step === 'localizacao'
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[styles.stepNum, styles.stepNumActive]}>1</Text>
                }
              </View>
              <Text style={[styles.stepLabel, step === 'dados' && styles.stepLabelActive]}>Dados</Text>
            </View>

            <View style={[styles.stepLine, step === 'localizacao' && styles.stepLineDone]} />

            <View style={styles.stepItem}>
              <View style={[styles.stepDot, step === 'localizacao' && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step === 'localizacao' && styles.stepNumActive]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, step === 'localizacao' && styles.stepLabelActive]}>Localização</Text>
            </View>
          </View>
        </View>

        {/* ── Passo 1: Dados pessoais ── */}
        {step === 'dados' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📋 Dados Pessoais</Text>

            <Text style={styles.label}>
              Telefone <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="+244 9XX XXX XXX"
                placeholderTextColor={COLORS.textLight}
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                returnKeyType="next"
                // Web: prevents autocomplete pollution
                autoComplete={Platform.OS === 'web' ? 'tel' : 'off'}
              />
            </View>

            <Text style={styles.label}>
              Data de Nascimento <Text style={styles.required}>*</Text>
            </Text>

            {/* ── Calendário ── */}
            {Platform.OS === 'web' ? (
              // Web: input date nativo envolto num inputRow estilizado
              <View style={[styles.inputRow, styles.inputRowDate]}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                {/* @ts-ignore — propriedade web-only */}
                <input
                  type="date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  value={dataNascimento}
                  onChange={(e: any) => {
                    const val = e?.target?.value || '';
                    if (val) {
                      const d = new Date(val + 'T00:00:00');
                      if (!isNaN(d.getTime())) {
                        setDatePickerDate(d);
                        setDataNascimento(val);
                      }
                    } else {
                      setDataNascimento('');
                    }
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 15,
                    color: dataNascimento ? '#1E293B' : '#94A3B8',
                    marginLeft: 8,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  } as any}
                />
              </View>
            ) : (
              // Mobile (iOS / Android)
              <>
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir calendário para selecionar data de nascimento"
                >
                  <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                  <Text style={[styles.input, !dataNascimento && { color: COLORS.textLight }]}>
                    {dataNascimento
                      ? (() => {
                          const d = new Date(dataNascimento + 'T00:00:00');
                          return isNaN(d.getTime()) ? dataNascimento : dateToDisplay(d);
                        })()
                      : 'Selecionar data'}
                  </Text>
                  <Ionicons name="calendar" size={20} color={COLORS.primary} />
                </TouchableOpacity>

                {/* DateTimePicker — modal nativo */}
                {showDatePicker && DateTimePicker && (
                  Platform.OS === 'ios' ? (
                    <Modal transparent animationType="slide">
                      <View style={styles.pickerOverlay}>
                        <View style={styles.pickerCard}>
                          <View style={styles.pickerHeader}>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                              <Text style={styles.pickerCancel}>Cancelar</Text>
                            </TouchableOpacity>
                            <Text style={styles.pickerTitle}>Data de Nascimento</Text>
                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                              <Text style={styles.pickerDone}>Confirmar</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={datePickerDate}
                            mode="date"
                            display="spinner"
                            onChange={onDateChange}
                            maximumDate={new Date()}
                            locale="pt-PT"
                          />
                        </View>
                      </View>
                    </Modal>
                  ) : (
                    // Android: abre diálogo nativo directamente
                    <DateTimePicker
                      value={datePickerDate}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                      maximumDate={new Date()}
                    />
                  )
                )}
              </>
            )}

            <Text style={styles.label}>
              Género <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => setShowGenero(!showGenero)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Selecionar género"
            >
              <Ionicons name="people-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.input, !genero && { color: COLORS.textLight }]}>
                {genero || 'Selecionar género'}
              </Text>
              <Ionicons name={showGenero ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showGenero && (
              <View style={styles.dropdown}>
                {GENEROS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.dropdownItem, genero === g && styles.dropdownItemSelected]}
                    onPress={() => { setGenero(g); setShowGenero(false); }}
                  >
                    <Text style={[styles.dropdownText, genero === g && styles.dropdownTextSelected]}>{g}</Text>
                    {genero === g && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => { if (validateStep1()) setStep('localizacao'); }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continuar para localização"
            >
              <Text style={styles.btnText}>Continuar</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Passo 2: Localização ── */}
        {step === 'localizacao' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📍 Localização</Text>

            <Text style={styles.label}>
              Província <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => setShowProvincias(!showProvincias)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Selecionar província"
            >
              <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.input, !provincia && { color: COLORS.textLight }]}>
                {provincia || 'Selecionar província'}
              </Text>
              <Ionicons name={showProvincias ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showProvincias && (
              // nestedScrollEnabled=true é necessário no Android dentro de ScrollView
              <ScrollView
                style={styles.dropdown}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {PROVINCIAS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.dropdownItem, provincia === p && styles.dropdownItemSelected]}
                    onPress={() => { setProvincia(p); setShowProvincias(false); }}
                  >
                    <Text style={[styles.dropdownText, provincia === p && styles.dropdownTextSelected]}>{p}</Text>
                    {provincia === p && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={[styles.label, { marginTop: SIZES.sm }]}>
              Rua / Bairro <Text style={styles.optional}>(opcional)</Text>
            </Text>
            <View style={styles.inputRow}>
              <Ionicons name="home-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Ex: Rua da Missão, Bairro Miramar"
                placeholderTextColor={COLORS.textLight}
                value={enderecoRua}
                onChangeText={setEnderecoRua}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            {/* Info — próximo passo */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>
                No passo seguinte, vai definir a sua senha pessoal.
              </Text>
            </View>

            {/* Botões */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={styles.btnBack}
                onPress={() => setStep('dados')}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                <Text style={styles.btnBackText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1, marginLeft: SIZES.sm }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Guardar perfil e continuar"
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Text style={styles.btnText}>Guardar e Continuar</Text>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    </>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.privacy}>
          🔒 Os seus dados são protegidos e usados apenas para fins clínicos.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Estilos (Platform.select para web vs native) ─────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.xxl,
    // paddingTop seguro para iOS notch, Android status bar e Web header
    paddingTop: Platform.select({ ios: 60, android: 40, default: 32 }) as number,
    alignItems: 'center', // centra os filhos horizontalmente
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
    ...SHADOWS.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SIZES.lg,
  },
  // ── Steps ──
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepDotDone: { backgroundColor: '#10B981' },
  stepNum: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepNumActive: { color: '#fff' },
  stepLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 6,
    marginRight: SIZES.sm,
  },
  stepLabelActive: { color: COLORS.primary, fontWeight: '600' },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SIZES.sm,
  },
  stepLineDone: { backgroundColor: '#10B981' },
  // ── Card ──
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    ...SHADOWS.md,
    marginBottom: SIZES.lg,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.lg,
  },
  label: {
    fontSize: SIZES.fontSm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  required: { color: '#EF4444' },
  optional: { color: COLORS.textLight, fontWeight: '400' },
  // ── Inputs ──
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SIZES.md,
    height: 52,
    marginBottom: SIZES.md,
  },
  input: {
    flex: 1,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    marginLeft: SIZES.sm,
    // Web: remove outline padrão do browser
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  // ── Dropdown ──
  dropdown: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxHeight: 200,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  // ── Date input (web) ──
  inputRowDate: {
    paddingVertical: 4,
  },
  // ── iOS DatePicker modal ──
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    ...SHADOWS.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: '700',
    color: COLORS.text,
  },
  pickerCancel: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
  },
  pickerDone: {
    fontSize: SIZES.fontMd,
    color: COLORS.primary,
    fontWeight: '700',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: { backgroundColor: '#EFF6FF' },
  dropdownText: { fontSize: SIZES.fontMd, color: COLORS.text },
  dropdownTextSelected: { color: COLORS.primary, fontWeight: '600' },
  // ── Info ──
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginTop: SIZES.xs,
    marginBottom: SIZES.md,
    gap: SIZES.sm,
  },
  infoText: {
    flex: 1,
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
    lineHeight: 18,
  },
  // ── Buttons ──
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    marginTop: SIZES.xs,
    ...SHADOWS.sm,
  },
  btnText: {
    color: '#fff',
    fontSize: SIZES.fontMd,
    fontWeight: '700',
  },
  btnBack: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 52,
    paddingHorizontal: SIZES.md,
    gap: 6,
  },
  btnBackText: { color: COLORS.primary, fontSize: SIZES.fontMd, fontWeight: '600' },
  privacy: {
    textAlign: 'center',
    fontSize: SIZES.fontSm,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
    paddingBottom: SIZES.md,
  },
});

export default CompleteProfileScreen;
