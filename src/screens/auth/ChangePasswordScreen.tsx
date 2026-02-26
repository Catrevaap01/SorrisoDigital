/**
 * Tela de Alteração de Senha Obrigatória
 * Mostrada quando usuário loga pela primeira vez
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import Toast from 'react-native-toast-message';
import { supabase } from '../../config/supabase';

interface ChangePasswordScreenProps {
  onPasswordChanged?: () => void;
  returnToHome?: boolean;
}

const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({
  onPasswordChanged,
  returnToHome = false,
}) => {
  const { profile, updateProfile } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [senhaConfirmar, setSenhaConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrarSenhas, setMostrarSenhas] = useState(false);

  const validarSenha = (senha: string): { valido: boolean; mensagem: string } => {
    if (!senha) {
      return { valido: false, mensagem: 'Senha é obrigatória' };
    }
    if (senha.length < 8) {
      return { valido: false, mensagem: 'Senha deve ter mínimo 8 caracteres' };
    }
    if (!/[A-Z]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter pelo menos uma maiúscula' };
    }
    if (!/[0-9]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter apenas números' };
    }
    if (!/[!@#$%^&*]/.test(senha)) {
      return { valido: false, mensagem: 'Senha deve conter um caractere especial (!@#$%^&*)' };
    }
    return { valido: true, mensagem: '' };
  };

  const handleAlterarSenha = async () => {
    // Validações
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
        text2: 'As senhas não coincidem',
      });
      return;
    }

    if (senhaAtual === senhaNova) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'A nova senha não pode ser igual à anterior',
      });
      return;
    }

    setLoading(true);

    try {
      // Alterar senha no Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: senhaNova,
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

      // Marcar que senha foi alterada
      const result = await updateProfile({
        ...profile,
        senha_alterada: true,
        updated_at: new Date().toISOString(),
      });

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Sucesso!',
          text2: 'Sua senha foi alterada com sucesso',
        });

        if (onPasswordChanged) {
          onPasswordChanged();
        }
      } else {
        throw new Error('Erro ao marcar senha como alterada');
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao alterar senha',
      });
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔐</Text>
            </View>
            <Text style={styles.title}>Altere sua Senha</Text>
            <Text style={styles.subtitle}>
              Esta é sua primeira vez. Por segurança, você deve alterar sua senha temporária.
            </Text>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>🔒 Requisitos de Segurança:</Text>
            <Text style={styles.infoText}>✓ Mínimo 8 caracteres</Text>
            <Text style={styles.infoText}>✓ Pelo menos uma letra maiúscula</Text>
            <Text style={styles.infoText}>✓ Pelo menos um número</Text>
            <Text style={styles.infoText}>✓ Pelo menos um caractere especial (!@#$%^&*)</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Senha Atual */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Senha Temporária Atual</Text>
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
              <Text style={styles.label}>Nova Senha</Text>
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
              <Text style={styles.label}>Confirmar Nova Senha</Text>
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
              <Text style={styles.toggleText}>
                {mostrarSenhas ? '👁️ Ocultar senhas' : '👁️ Mostrar senhas'}
              </Text>
              <Text
                style={styles.toggleButton}
                onPress={() => setMostrarSenhas(!mostrarSenhas)}
              >
                {mostrarSenhas ? 'Ocultar' : 'Mostrar'}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <Button
              title={loading ? 'Alterando...' : 'Alterar Senha'}
              onPress={handleAlterarSenha}
              disabled={
                loading ||
                !senhaAtual.trim() ||
                !senhaNova.trim() ||
                !senhaConfirmar.trim()
              }
              loading={loading}
            />
          </View>

          {/* Footer Text */}
          <Text style={styles.footerText}>
            Sua senha será alterada imediatamente. Você será desconectado após a alteração.
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
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  icon: {
    fontSize: 56,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  toggleText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
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
  footerText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: SPACING.md,
  },
});

export default ChangePasswordScreen;
