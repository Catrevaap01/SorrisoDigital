/**
 * Tela de Alteracao de Senha Obrigatoria
 * Mostrada quando usuario loga pela primeira vez
 */

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
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY, SIZES, SHADOWS } from '../../styles/theme';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { supabase, PROFILE_SCHEMA_FEATURES } from '../../config/supabase';

interface ChangePasswordScreenProps {
  onPasswordChanged?: () => void;
  returnToHome?: boolean;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  onPasswordChanged,
  returnToHome = false,
}) => {
  const { user, updateProfile } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmar, setSenhaConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [progressStep, setProgressStep] = useState('');

  const validarSenha = (senha: string): { valido: boolean; mensagem: string } => {
    if (!senha) {
      return { valido: false, mensagem: 'Senha e obrigatoria' };
    }
    if (senha.length < 8) {
      return { valido: false, mensagem: 'Senha deve ter minimo 8 caracteres' };
    }
    if (!/[A-Z]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter pelo menos uma letra maiuscula' };
    }
    if (!/[0-9]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter pelo menos um numero' };
    }
    if (!/[!@#$%^&*]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter um caractere especial (!@#$%^&*)' };
    }
    return { valido: true, mensagem: '' };
  };

  const handleAlterarSenha = async () => {
    // Validacoes
    if (!senhaAtual.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Digite sua senha atual',
      });
      return;
    }

    const validacao = validarSenha(senhaNova);
    if (!validacao.valido) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: validacao.mensagem,
      });
      return;
    }

    if (senhaNova !== senhaConfirmar) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'As senhas nao coincidem',
      });
      return;
    }

    if (senhaAtual === senhaNova) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'A nova senha nao pode ser igual a anterior',
      });
      return;
    }

    setLoading(true);
    setProgressStep('Validando dados...');

    try {
      setProgressStep('Atualizando senha no sistema...');
      // Alterar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: senhaNova,
        data: {
          ...(user?.user_metadata || {}),
          force_password_change: false,
        },
      });

      if (authError) {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: authError.message,
        });
        setLoading(false);
        return;
      }

      if (PROFILE_SCHEMA_FEATURES.hasSenhaAlterada) {
        setProgressStep('Atualizando perfil...');
        const result = await updateProfile({
          senha_alterada: true,
        });

        if (!result.success) {
          throw new Error('Erro ao marcar senha como alterada');
        }
      }

      setProgressStep('Concluindo...');
      Toast.show({
        type: 'success',
        text1: 'Sucesso!',
        text2: 'Sua senha foi alterada com sucesso',
      });

      if (onPasswordChanged) {
        onPasswordChanged();
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao alterar senha',
      });
    } finally {
      setProgressStep('');
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
        <View style={styles.centerWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="medical" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.logoTitle}>TeOdonto</Text>
              <Text style={styles.logoSubtitle}>Angola</Text>
            </View>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Altere sua senha</Text>
            <Text style={styles.subtitle}>
              Este é o seu primeiro acesso. Por segurança, altere a senha temporária.
            </Text>
          </View>

          {/* Card com os campos - padrão idêntico ao cadastro */}
          <View style={styles.card}>
            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Requisitos de segurança:</Text>
              <Text style={styles.infoText}>• Mínimo de 8 caracteres</Text>
              <Text style={styles.infoText}>• Pelo menos uma letra maiúscula</Text>
              <Text style={styles.infoText}>• Pelo menos um número</Text>
              <Text style={styles.infoText}>• Pelo menos um caractere especial (!@#$%^&*)</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Senha Atual */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Senha temporária atual</Text>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChangeText={setSenhaAtual}
                    secureTextEntry={!mostrarSenhas}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Nova Senha */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nova senha</Text>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="Digite sua nova senha"
                    value={senhaNova}
                    onChangeText={setSenhaNova}
                    secureTextEntry={!mostrarSenhas}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Confirmar Senha */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Confirmar nova senha</Text>
                <View style={styles.inputWrapper}>
                  <Input
                    placeholder="Confirme sua nova senha"
                    value={senhaConfirmar}
                    onChangeText={setSenhaConfirmar}
                    secureTextEntry={!mostrarSenhas}
                    editable={!loading}
                  />
                </View>
              </View>

              {/* Show Password Toggle */}
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={styles.toggleButtonWrapper}
                  onPress={() => setMostrarSenhas(!mostrarSenhas)}
                >
                  <Ionicons
                    name={mostrarSenhas ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.toggleText}>
                    {mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              <Button
                title={loading ? 'Alterando...' : 'Alterar senha'}
                onPress={handleAlterarSenha}
                disabled={
                  loading ||
                  !senhaAtual.trim() ||
                  !senhaNova.trim() ||
                  !senhaConfirmar.trim()
                }
                loading={loading}
              />
              {loading && !!progressStep && (
                <View style={styles.progressBox}>
                  <Text style={styles.progressText}>{progressStep}</Text>
                </View>
              )}
            </View>

            {/* Footer Text */}
            <Text style={styles.footerText}>
              Sua senha será alterada imediatamente após a confirmação.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: Platform.select({ web: 32, default: SIZES.lg }),
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  logoSubtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.secondary,
    marginTop: -4,
  },
  iconContainer: {
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    padding: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.lg,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: '#388E3C',
    marginBottom: 2,
    lineHeight: 18,
  },
  form: {
    marginBottom: SPACING.sm,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  buttonsContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  progressBox: {
    marginTop: SPACING.md,
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  progressText: {
    color: '#1565C0',
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '600',
  },
  footerText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
});

export default ChangePasswordScreen;
