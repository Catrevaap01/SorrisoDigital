import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { authService } from '../../services/authService';
import {
  recuperarSenhaPaciente,
  getUserTipoByEmail,
} from '../../services/passwordRecoveryService';

interface ForgotPasswordProps {
  navigation: any;
}

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Toast.show({ type: 'error', text1: 'Informe o e-mail', text2: 'Digite um e-mail para prosseguir' });
      return;
    }

    setLoading(true);
    try {
      // confirm user type before attempting recovery
      const tipo = await getUserTipoByEmail(trimmed);
      if (tipo !== 'paciente') {
        Toast.show({
          type: 'error',
          text1: 'Recuperação indisponível',
          text2:
            tipo === 'dentista'
              ? 'Use a funcionalidade de administração para resetar a senha do dentista'
              : 'Apenas pacientes podem recuperar senha aqui',
        });
        return;
      }

      const result = await recuperarSenhaPaciente(trimmed);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Senha temporária enviada',
          text2: 'Confira seu e-mail e faça login para alterar a senha',
        });
        navigation.goBack();
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: result.error || 'Falha ao recuperar senha',
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Erro', text2: err.message || 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.title}>Recuperar Senha</Text>
            <Text style={styles.subtitle}>
              Informe o e‑mail associado à sua conta. Enviaremos uma senha temporária
              por e‑mail que você deverá alterar ao efetuar login.
            </Text>
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

            <Button
              title={loading ? 'Enviando...' : 'Enviar recuperação'}
              onPress={handleReset}
              disabled={loading || !email}
              loading={loading}
            />
          </View>

          <View style={styles.footer}>
            <Button
              title="Voltar ao login"
              variant="secondary"
              onPress={() => navigation.goBack()}
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
    textAlign: 'center',
  },
  form: {
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
});
