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
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Cabeçalho */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="person-add" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Criar Conta</Text>
          <Text style={styles.subtitle}>Paciente</Text>
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
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
          <Text style={styles.disclaimerText}>
            Os seus dados são protegidos. Este app não substitui consulta presencial.
          </Text>
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
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
    marginBottom: SIZES.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: SIZES.fontXl,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: -2,
  },
  tagline: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusXl,
    padding: SIZES.lg,
    ...SHADOWS.md,
    marginBottom: SIZES.lg,
  },
  fieldLabel: {
    fontSize: SIZES.fontSm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: SIZES.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.md,
    height: 52,
  },
  input: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    // Web: remove o outline azul do browser
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.sm,
    marginTop: SIZES.sm,
    ...SHADOWS.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontSize: SIZES.fontLg,
    fontWeight: '700',
  },
  stepsInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginTop: SIZES.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  stepsTitle: {
    fontSize: SIZES.fontSm,
    fontWeight: '700',
    color: '#166534',
    marginBottom: SIZES.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: SIZES.sm,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: SIZES.fontSm, color: '#166534', flex: 1 },
  loginLink: { alignItems: 'center', marginTop: SIZES.lg },
  loginText: { color: COLORS.textSecondary, fontSize: SIZES.fontMd },
  loginTextBold: { color: COLORS.primary, fontWeight: '700' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    gap: SIZES.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default RegisterScreen;
