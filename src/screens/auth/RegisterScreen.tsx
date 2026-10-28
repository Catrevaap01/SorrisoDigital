/**
 * RegisterScreen.tsx
 *
 * Auto-registo de pacientes.
 * ✅ Compatível com: iOS · Android · Web · PWA
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const showError = (title: string, message: string) =>
  Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 4000 });

const showSuccess = (title: string, message: string) =>
  Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 5000 });

// ─── Componente ───────────────────────────────────────────────────────────────

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();

  // ── Validação ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    if (!nome.trim() || !email.trim() || !password || !confirmPassword) {
      showError('Campos obrigatórios', 'Por favor preencha todos os campos.');
      return false;
    }
    if (!email.includes('@') || email.split('@')[1]?.indexOf('.') === -1) {
      showError('Email inválido', 'Insira um endereço de email válido.');
      return false;
    }
    if (password.length < 6) {
      showError('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    if (password !== confirmPassword) {
      showError('Senhas não coincidem', 'As duas senhas têm de ser iguais.');
      return false;
    }
    return true;
  };

  // ── Registo ────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signUp(email.trim().toLowerCase(), password, {
        nome: nome.trim(),
        tipo: 'paciente',
        senha_alterada: false, // onboarding → forçar mudança de senha
      });

      if (result.success) {
        const hasSession = Boolean(result.data?.session);
        if (!hasSession) {
          // Supabase confirmação por email activada
          showSuccess(
            '✅ Conta criada!',
            'Verifique o seu email para confirmar a conta e depois faça login.'
          );
          setTimeout(() => navigation.replace('Login'), 2500);
        }
        // hasSession=true → AppNavigator detecta needsProfileCompletion → CompleteProfile
      } else {
        const msg =
          (result.error as any)?.message || 'Erro ao criar conta. Tente novamente.';
        showError('Erro no registo', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── KAV behavior cross-platform ────────────────────────────────────────────
  const kavBehavior = Platform.select<'padding' | 'height' | 'position' | undefined>({
    ios: 'padding',
    android: 'height',
    default: undefined,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={kavBehavior}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrapper}>
         

          {/* Logo / Cabeçalho */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={38} color={COLORS.primary} />
            </View>
            <Text style={styles.title} accessibilityRole="header">Criar Conta</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#15803D" />
              <Text style={styles.roleBadgeText}>Paciente</Text>
            </View>
            <Text style={styles.tagline}>Registe-se para começar a usar o TeOdonto Angola</Text>
          </View>

          {/* Formulário */}
          <View style={styles.formContainer}>
            {/* Nome */}
            <Text style={styles.fieldLabel}>Nome completo</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="O seu nome completo"
                placeholderTextColor={COLORS.textLight}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
                returnKeyType="next"
                autoComplete={Platform.OS === 'web' ? 'name' : 'off'}
                accessibilityLabel="Nome completo"
              />
            </View>

            {/* Email */}
            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="email@exemplo.com"
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                autoComplete={Platform.OS === 'web' ? 'email' : 'off'}
                accessibilityLabel="Email"
              />
            </View>

            {/* Senha */}
            <Text style={styles.fieldLabel}>Senha</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                autoComplete={Platform.OS === 'web' ? 'new-password' : 'off'}
                accessibilityLabel="Senha"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Confirmar Senha */}
            <Text style={styles.fieldLabel}>Confirmar senha</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Repita a senha"
                placeholderTextColor={COLORS.textLight}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                autoComplete={Platform.OS === 'web' ? 'new-password' : 'off'}
                accessibilityLabel="Confirmar senha"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Botão */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Criar conta"
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Text style={styles.buttonText}>Criar Conta</Text>
                    <Ionicons name="arrow-forward-circle" size={22} color="#fff" />
                  </>
              }
            </TouchableOpacity>

            {/* Já tem conta */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.replace('Login')}
              accessibilityRole="link"
            >
              <Text style={styles.loginText}>
                Já tem conta?{' '}
                <Text style={styles.loginTextBold}>Faça login</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
            <Text style={styles.disclaimerText}>
              Os seus dados são protegidos. Este app não substitui consulta presencial.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZES.lg,
    paddingBottom: SIZES.xxl,
    paddingTop: Platform.select({ ios: 60, android: 40, default: 32 }) as number,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webScrollContent: {
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    marginBottom: SIZES.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  backButtonText: {
    fontSize: SIZES.fontSm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SIZES.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: Platform.select({ web: 32, default: SIZES.lg }),
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SIZES.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: SIZES.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 50,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.text,
    // Web: remove o outline azul do browser
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  eyeButton: {
    padding: 6,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    ...SHADOWS.sm,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 4,
    ...Platform.select({ web: { cursor: 'pointer' } as any, default: {} }),
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loginTextBold: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E40AF',
    lineHeight: 18,
  },
});

export default RegisterScreen;
