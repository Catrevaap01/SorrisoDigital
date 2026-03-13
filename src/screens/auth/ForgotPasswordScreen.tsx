import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { copiarParaAreaDeTransferencia } from '../../utils/senhaUtils';
import { COLORS, SPACING, TYPOGRAPHY, SIZES } from '../../styles/theme';
import { recuperarSenhaPaciente } from '../../services/passwordRecoveryService';
import { notifyNewMessage } from '../../services/localNotificationService';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [novaSenha, setNovaSenha] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await recuperarSenhaPaciente(email.trim().toLowerCase());
      if (result.success) {
        setNovaSenha(result.novaSenha || null);
        Toast.show({
          type: 'success',
          text1: 'Senha alterada',
          text2: result.emailSent
            ? 'Senha temporária enviada por email e notificação'
            : 'Senha alterada, verifique seu email',
        });
        if (result.emailSent) {
          await notifyNewMessage(
            'Recuperação de senha',
            'Sua senha temporária foi enviada por email'
          );
        }
        // keep on screen so user can copy novaSenha if needed
        // navigation.goBack();
      } else {
        setError(result.error || 'Erro ao recuperar senha');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={40} color={COLORS.primary} />
            </TouchableOpacity>
            
          <View style={styles.header}>
            <Text style={styles.title}>Esqueceu sua senha?</Text>
            <Text style={styles.subtitle}>
              Informe o e-mail cadastrado (apenas pacientes podem recuperar
              senha). Você receberá instruções por e-mail ou notificação.
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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {novaSenha ? (
              <View style={styles.resultContainer}>
                <Text style={styles.resultLabel}>Senha temporária:</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultValue}>{novaSenha}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={async () => {
                      const copiado = await copiarParaAreaDeTransferencia(novaSenha!);
                      Toast.show({
                        type: copiado ? 'success' : 'info',
                        text1: copiado ? 'Copiado!' : 'Não foi possível copiar',
                      });
                    }}
                  >
                    <Ionicons name="copy" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Button
              title={loading ? 'Enviando...' : 'Recuperar senha'}
              onPress={handleSubmit}
              disabled={loading || !email}
              loading={loading}
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
    paddingLeft: SIZES.xl, // leave room for back arrow
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
  resultContainer: {
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    marginBottom: SPACING.md,
  },
  resultLabel: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.small,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultValue: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    flex: 1,
  },
  copyButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.md,
  },
  backButton: {
    position: 'absolute',
    top: -SPACING.sm, // float higher/isolated above header
    left: 0,
    padding: SPACING.sm,
    zIndex: 10,
  },
});
