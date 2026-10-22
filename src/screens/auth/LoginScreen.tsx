import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY, SIZES, SHADOWS } from '../../styles/theme';
import { AuthStackParamList } from '../../navigation/types';
import { canSelfRegister } from '../../utils/platformUtils';

export default function LoginScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [resendingMfa, setResendingMfa] = useState(false);
  const [error, setError] = useState('');

  const { login, pendingMfa, verifyMfaCode, cancelMfaChallenge, resendWhatsAppMfa } = useAuth();
  // canSelfRegister() detecta Electron, Tauri, file://, RN Windows — oculta
  // 'Criar Conta' e 'Esqueceu a senha?' nesses contextos desktop/EXE
  const showRegisterOptions = canSelfRegister();

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      const urlPassword = params.get('password');

      if (urlEmail) setEmail(urlEmail.trim());
      if (urlPassword) setPassword(urlPassword);

      if (urlEmail && urlPassword) {
        console.log('QR: Auto-login detected from URL params');
        setTimeout(() => {
          void handleLogin(urlEmail.trim(), urlPassword);
        }, 1000);
      }
    }
  }, []);

  const handleLogin = async (overrideEmail?: string, overridePass?: string) => {
    setError('');
    setLoading(true);

    try {
      const emailValue = overrideEmail ?? email;
      const cleanEmail =
        typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
      const cleanPass = typeof overridePass === 'string' ? overridePass : password;

      if (!cleanEmail || !cleanPass) {
        throw new Error('Informe email e senha para entrar.');
      }

      console.log(
        `Attempting login for: [${cleanEmail}] (Pass length: ${String(cleanPass).length})`
      );

      const result = await login(cleanEmail, cleanPass);
      if (!result.success) {
        throw result.error || new Error('Erro ao fazer login');
      }

      console.log('Login successful from LoginScreen');
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Login failed from LoginScreen:', errorMsg);
      // Erros são mostrados via Toast pelo AuthContext
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    setVerifyingMfa(true);
    try {
      const result = await verifyMfaCode(mfaCode);
      if (result.success) {
        setMfaCode('');
      }
    } finally {
      setVerifyingMfa(false);
    }
  };

  const handleResendWhatsApp = async () => {
    setResendingMfa(true);
    try {
      await resendWhatsAppMfa();
    } finally {
      setResendingMfa(false);
    }
  };

  const handleCancelMfa = async () => {
    setMfaCode('');
    await cancelMfaChallenge();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={Platform.OS === 'web' ? styles.webWrapper : styles.content}>
          <View style={[styles.content, Platform.OS === 'web' && styles.webCard]}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <View style={styles.logoCircle}>
                  <Ionicons name="medical" size={50} color={COLORS.primary} />
                </View>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                  style={{ marginTop: SPACING.lg }}
                />
              </View>
            )}

            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="medical" size={50} color={COLORS.primary} />
              </View>
              <Text style={styles.title}>Odontologia Angola</Text>
              <Text style={styles.subtitle}>Bem-vindo de volta</Text>
            </View>

            <View style={styles.form}>
              <Input
                label="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />

              <Input
                label="Senha"
                placeholder="Sua senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />

              {/* Sem mensagem de erro visível — feedback via Toast */}

              <Button
                title={loading ? 'Entrando...' : 'Entrar'}
                onPress={() => {
                  void handleLogin();
                }}
                disabled={loading || !email || !password}
                loading={loading}
              />

              {showRegisterOptions && (
                <>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={{ marginTop: SPACING.md, alignItems: 'center' }}
                    accessibilityRole="link"
                  >
                    <Text style={{ color: COLORS.primary, fontSize: TYPOGRAPHY.sizes.small }}>
                      Esqueceu a senha?
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('Register')}
                    style={{ marginTop: SPACING.md, alignItems: 'center' }}
                    accessibilityRole="link"
                  >
                    <Text style={{ color: COLORS.textSecondary, fontSize: TYPOGRAPHY.sizes.small }}>
                      Não tem conta?{' '}
                      <Text style={{ color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' }}>
                        Cadastre-se.
                      </Text>
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                onPress={() => navigation.navigate('Welcome')}
                style={{ marginTop: SPACING.md, alignItems: 'center' }}
              >
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontSize: TYPOGRAPHY.sizes.small,
                    textDecorationLine: 'underline',
                  }}
                >
                  Voltar à tela inicial
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={!!pendingMfa}
        transparent
        animationType="fade"
        onRequestClose={() => {
          void handleCancelMfa();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mfaModal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
            >
              <View
                style={[
                  styles.mfaIcon,
                  pendingMfa?.factorType === 'whatsapp' && { backgroundColor: '#E8F5E9' },
                ]}
              >
                <Ionicons
                  name={pendingMfa?.factorType === 'whatsapp' ? 'logo-whatsapp' : 'shield-checkmark'}
                  size={34}
                  color={pendingMfa?.factorType === 'whatsapp' ? '#25D366' : COLORS.primary}
                />
              </View>

              <Text style={styles.mfaTitle}>
                {pendingMfa?.factorType === 'whatsapp'
                  ? 'Verificação via WhatsApp'
                  : 'Código de verificação'}
              </Text>

              <Text style={styles.mfaSubtitle}>
                {pendingMfa?.factorType === 'whatsapp'
                  ? `Introduza o código de 6 dígitos que enviámos para o seu WhatsApp (${pendingMfa.phone || 'cadastrado'}).`
                  : 'Abra o seu aplicativo autenticador e introduza o código de 6 dígitos.'}
              </Text>

              <Input
                label="Código de 6 dígitos"
                placeholder="000000"
                value={mfaCode}
                onChangeText={(value) => setMfaCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                disabled={verifyingMfa}
                style={styles.mfaInput}
              />

              <Button
                title={verifyingMfa ? 'Verificando...' : 'Verificar e Entrar'}
                onPress={() => {
                  void handleVerifyMfa();
                }}
                disabled={verifyingMfa || mfaCode.length !== 6}
                loading={verifyingMfa}
                fullWidth
              />

              {pendingMfa?.factorType === 'whatsapp' && (
                <TouchableOpacity
                  onPress={() => {
                    void handleResendWhatsApp();
                  }}
                  style={styles.mfaResend}
                  disabled={resendingMfa || verifyingMfa}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={styles.mfaResendText}>
                    {resendingMfa ? 'Reenviando...' : 'Reenviar código no WhatsApp'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => {
                  void handleCancelMfa();
                }}
                style={styles.mfaCancel}
                disabled={verifyingMfa}
              >
                <Text style={styles.mfaCancelText}>Cancelar login</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const safeShadow = SHADOWS?.sm || {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  content: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...safeShadow,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h1,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  form: {
    gap: SPACING.md,
  },
  error: {
    color: COLORS.danger,
    fontSize: SIZES.fontSm,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  webWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webScrollContent: {
    paddingVertical: 40,
  },
  webCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...(SHADOWS?.md || {}),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  mfaModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...(SHADOWS?.md || {}),
  },
  mfaIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  mfaTitle: {
    fontSize: TYPOGRAPHY.sizes.h3 || 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  mfaSubtitle: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  mfaInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  mfaCancel: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  mfaCancelText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '600',
  },
  mfaResend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.md,
    paddingVertical: 10,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  mfaResendText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: TYPOGRAPHY.sizes.small || 13,
  },
});
