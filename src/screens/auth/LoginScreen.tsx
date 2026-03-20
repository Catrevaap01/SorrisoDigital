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
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY, SIZES } from '../../styles/theme';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';

export default function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      let userError = err.message || 'Erro ao fazer login';
      
      // Ficha/temp cred common errors
      const lowerMsg = userError.toLowerCase();
      if (lowerMsg.includes('invalid login') || lowerMsg.includes('senha')) {
        userError = 'Credenciais inválidas. Verifique email e senha da ficha.';
      } else if (lowerMsg.includes('must be changed') || lowerMsg.includes('force')) {
        userError = 'Senha temporária expirou. Peça nova ficha ao dentista.';
      } else if (lowerMsg.includes('email not confirmed')) {
        userError = 'Email precisa confirmação. Verifique caixa de entrada.';
      }
      
      setError(userError);
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
          Platform.OS === 'web' && styles.webScrollContent
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.content,
          Platform.OS === 'web' && styles.webContent
        ]}>
{loading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.logoCircle}>
                <Ionicons name="medical" size={50} color={COLORS.primary} />
              </View>
              <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop:SPACING.lg}} />
            </View>
          )}
          {/* logo same as cadastro */}
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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title={loading ? 'Entrando...' : 'Entrar'}
              onPress={handleLogin}
              disabled={loading || !email || !password}
              loading={loading}
            />

            {Platform.OS !== 'web' && (
              <View style={styles.footer}>
                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                  <Text style={styles.footerText}>
                    Não tem uma conta? <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>Cadastre-se</Text>
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={{ marginTop: SPACING.md }}
                >
                  <Text style={{ color: COLORS.primary, fontSize: TYPOGRAPHY.sizes.small }}>
                    Esqueceu a senha?
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
  webScrollContent: {
    backgroundColor: '#EEF2F6', // Fundo levemente azulado/cinza premium
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: SIZES.radiusLg,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0,0,0,0.05), 0 5px 10px rgba(0,0,0,0.05)',
      }
    }),
    marginVertical: SPACING.xl,
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
  logoContainer: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  form: {
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  error: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.small,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  footerText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.small,
  },
});
