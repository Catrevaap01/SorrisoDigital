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
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="medical" size={44} color={COLORS.primary} />
              </View>
              <Text style={styles.logoTitle}>TeOdonto</Text>
              <Text style={styles.logoSubtitle}>Angola</Text>
            </View>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed-outline" size={34} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Altere sua senha</Text>
            <Text style={styles.subtitle}>
              Este e seu primeiro acesso. Por seguranca, altere a senha temporaria.
            </Text>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Requisitos de seguranca:</Text>
            <Text style={styles.infoText}>- Minimo de 8 caracteres</Text>
            <Text style={styles.infoText}>- Pelo menos uma letra maiuscula</Text>
            <Text style={styles.infoText}>- Pelo menos um numero</Text>
            <Text style={styles.infoText}>- Pelo menos um caractere especial (!@#$%^&*)</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Senha Atual */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Senha temporaria atual</Text>
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
                  size={24}
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
            Sua senha sera alterada imediatamente apos a confirmacao.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
    borderRadius: 8,
    marginBottom: SPACING.lg,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: '#558B2F',
    marginBottom: SPACING.xs,
    lineHeight: 18,
  },
  form: {
    marginBottom: SPACING.lg,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.lg,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  toggleButtonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  toggleButton: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  buttonsContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
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
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: SPACING.md,
  },
});

export default ChangePasswordScreen;
