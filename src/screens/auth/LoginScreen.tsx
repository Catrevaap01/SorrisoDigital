import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTipoByEmail } from '../../services/passwordRecoveryService';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (email.trim()) {
      timeout = setTimeout(async () => {
        const tipo = await getUserTipoByEmail(email.trim().toLowerCase());
        setShowForgot(tipo === 'paciente');
      }, 500);
    } else {
      setShowForgot(false);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [email]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Te Odonto Angola</Text>
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

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title={loading ? 'Entrando...' : 'Entrar'}
              onPress={handleLogin}
              disabled={loading || !email || !password}
              loading={loading}
            />

            {showForgot && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={loading}
              >
                <Text style={[styles.footerText, { textDecorationLine: 'underline' }]}>Esqueci minha senha</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <Button
              title="Cadastre-se"
              onPress={() => navigation.navigate('Register')}
              variant="secondary"
              disabled={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h1,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
  },
  form: {
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  error: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.small,
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
  },
});
