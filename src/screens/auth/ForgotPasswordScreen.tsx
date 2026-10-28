import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { copiarParaAreaDeTransferencia } from '../../utils/senhaUtils';
import { COLORS, SPACING, TYPOGRAPHY, SIZES, SHADOWS } from '../../styles/theme';
import { recuperarSenhaPaciente } from '../../services/passwordRecoveryService';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const cardWidth = '100%';
const CARD_MAX_WIDTH = 420;

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [novaSenha, setNovaSenha] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    setNovaSenha(null);

    const emailTrimmed = email.trim().toLowerCase();
    try {
      // Recuperar senha do paciente: gera senha temporária, salva no DB e envia por email real
      const result = await recuperarSenhaPaciente(emailTrimmed);
      if (result.success) {
        setNovaSenha(result.novaSenha || null);
        Toast.show({
          type: 'success',
          text1: result.emailSent ? '✅ Senha enviada por email!' : '✅ Senha temporária gerada',
          text2: result.emailSent
            ? 'Verifique a sua caixa de correio para obter a senha temporária.'
            : 'Copie a senha abaixo e use-a para entrar.',
          visibilityTime: 6000,
        });
      } else {
        throw new Error(result.error || 'Erro ao recuperar senha');
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
            <View style={styles.backIconWrapper}>
              <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.backText}>Voltar ao login</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.imageContainer}>
              <Image 
                source={require('../../../assets/forgot_password_illustration.jpg')} 
                style={styles.illustration}
                resizeMode="contain"
              />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Esqueceu sua senha?</Text>
              <Text style={styles.subtitle}>
                Informe o seu e-mail para recuperar o acesso à sua conta e receber uma senha temporária.
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="E-mail registado"
                placeholder="Ex: exemplo@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading && !novaSenha}
                icon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
              />

              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              {novaSenha ? (
                <View style={styles.resultContainer}>
                  <View style={styles.resultHeader}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    <Text style={styles.resultLabel}>Sucesso! Senha temporária:</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultValue}>{novaSenha}</Text>
                    <TouchableOpacity
                      style={styles.copyButton}
                      onPress={async () => {
                        const copiado = await copiarParaAreaDeTransferencia(novaSenha!);
                        Toast.show({
                          type: copiado ? 'success' : 'info',
                          text1: copiado ? 'Copiado!' : 'Erro ao copiar',
                        });
                      }}
                    >
                      <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.resultHint}>Esta senha foi enviada para o seu email. Use-a para entrar e depois altere-a.</Text>
                </View>
              ) : null}

              {!novaSenha && (
                <Button
                  title={loading ? 'Enviando...' : 'Recuperar senha'}
                  onPress={handleSubmit}
                  disabled={loading || !email}
                  loading={loading}
                />
              )}
              
              {novaSenha && (
                <Button
                  title="Fazer Login"
                  onPress={() => navigation.goBack()}
                  variant="ghost"
                />
              )}
            </View>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Apenas pacientes podem recuperar a senha automaticamente. Profissionais de saúde devem contactar o Administrador.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Soft light background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  content: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  backIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  backText: {
    marginLeft: SPACING.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.primary,
    fontWeight: '600',
  },
  card: {
    width: cardWidth as any,
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusXl,
    padding: SPACING.xl,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignSelf: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  illustration: {
    width: 280,
    height: 200,
  },
  header: {
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: '800',
    color: '#0F172A', // Dark slate for premium look
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: SPACING.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: SPACING.sm,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  error: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.sizes.small,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  resultContainer: {
    padding: SPACING.md,
    backgroundColor: '#F0FDF4', // Light success green
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: SPACING.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resultLabel: {
    color: COLORS.success,
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultValue: {
    color: '#1E293B',
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '800',
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', // Monospaced password
  },
  resultHint: {
    fontSize: TYPOGRAPHY.sizes.xsmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  copyButton: {
    padding: SPACING.xs,
  },
  footer: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
  footerText: {
    fontSize: TYPOGRAPHY.sizes.xsmall,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
