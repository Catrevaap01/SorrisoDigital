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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY, SIZES, SHADOWS } from '../../styles/theme';
import { AuthStackParamList } from '../../navigation/types';

export default function LoginScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

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
      console.error('Login failed from LoginScreen:', err);
      // Erros são mostrados via Toast pelo AuthContext
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
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

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={{ marginTop: SPACING.md, alignItems: 'center' }}
              >
                <Text
                  style={{
                    color: COLORS.primary,
                    fontSize: TYPOGRAPHY.sizes.small,
                  }}
                >
                  Esqueceu a senha?
                </Text>
              </TouchableOpacity>

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
});
