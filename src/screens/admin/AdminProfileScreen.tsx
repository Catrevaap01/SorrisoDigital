import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

const PROVINCIAS_ADMIN = [
  'Luanda',
  'Benguela',
  'Huambo',
  'Huila',
  'Bie',
  'Malanje',
  'Uige',
  'Zaire',
  'Cabinda',
  'Cunene',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Namibe',
  'Bengo',
];

const AdminProfileScreen: React.FC = () => {
  const { profile, updateProfile, signOut } = useAuth();
  const [editando, setEditando] = useState(false);
  const [abrirChangePassword, setAbrirChangePassword] = useState(false);
  const [abrirProvincias, setAbrirProvincias] = useState(false);
  const [processando, setProcessando] = useState(false);

  const [nome, setNome] = useState(profile?.nome || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [provincia, setProvincia] = useState(profile?.provincia || '');

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmaSenha, setMostrarConfirmaSenha] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setEditando(false);
      setNome(profile?.nome || '');
      setTelefone(profile?.telefone || '');
      setProvincia(profile?.provincia || '');
    }, [profile])
  );

  const handleSalvarAlteracoes = async () => {
    if (!nome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome e obrigatorio' });
      return;
    }

    setProcessando(true);
    const resultado = await updateProfile({ nome, telefone, provincia: provincia.trim() });

    if (resultado.success) {
      setEditando(false);
      Toast.show({
        type: 'success',
        text1: 'Perfil atualizado',
        text2: 'Dados salvos com sucesso',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: resultado.error?.message || 'Erro ao atualizar perfil',
      });
    }

    setProcessando(false);
  };

  const handleMudarSenha = async () => {
    if (!senhaAtual.trim()) {
      Toast.show({ type: 'error', text1: 'Senha atual e obrigatoria' });
      return;
    }

    if (!novaSenha.trim()) {
      Toast.show({ type: 'error', text1: 'Nova senha e obrigatoria' });
      return;
    }

    if (novaSenha.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Nova senha deve ter no minimo 6 caracteres',
      });
      return;
    }

    if (novaSenha !== confirmaSenha) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'As senhas nao coincidem',
      });
      return;
    }

    setProcessando(true);
    try {
      Toast.show({
        type: 'info',
        text1: 'Em desenvolvimento',
        text2: 'Mudanca de senha sera implementada em breve',
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Terminar sessao', 'Tem certeza que deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          setProcessando(true);
          await signOut();
          setProcessando(false);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.nome?.charAt(0).toUpperCase() || 'A'}</Text>
          </View>
          <Text style={styles.role}>Administrador</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Informacoes pessoais</Text>
          {!editando && (
            <TouchableOpacity onPress={() => setEditando(true)}>
              <Ionicons name="pencil" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>

        {editando ? (
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Digite seu nome"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                placeholder="(+244) 923 456 789"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Provincia</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setAbrirProvincias(true)}
                disabled={processando}
              >
                <Text style={[styles.selectText, !provincia && styles.selectPlaceholder]}>
                  {provincia || 'Selecione uma provincia'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setEditando(false)}
                disabled={processando}
              >
                <Text style={styles.buttonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, processando && styles.buttonDisabled]}
                onPress={handleSalvarAlteracoes}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator color={COLORS.textInverse} />
                ) : (
                  <Text style={styles.buttonText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <InfoCard icon="person" label="Nome" valor={profile?.nome || 'Nao informado'} />
            <InfoCard icon="mail" label="Email" valor={profile?.email || 'Nao informado'} />
            <InfoCard icon="call" label="Telefone" valor={profile?.telefone || 'Nao informado'} />
            <InfoCard icon="location" label="Provincia" valor={profile?.provincia || 'Nao informado'} />
            <InfoCard
              icon="calendar"
              label="Membro desde"
              valor={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('pt-PT')
                  : 'Nao informado'
              }
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Seguranca</Text>
        <TouchableOpacity style={styles.actionCard} onPress={() => setAbrirChangePassword(true)}>
          <View style={styles.actionCardContent}>
            <Ionicons name="key" size={24} color={COLORS.warning} />
            <View style={styles.actionCardText}>
              <Text style={styles.actionCardTitle}>Mudar senha</Text>
              <Text style={styles.actionCardSubtitle}>Altere sua senha a qualquer momento</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acoes</Text>
        <TouchableOpacity
          style={[styles.actionCard, styles.actionCardDanger]}
          onPress={handleLogout}
          disabled={processando}
        >
          <View style={styles.actionCardContent}>
            <Ionicons name="log-out" size={24} color={COLORS.danger} />
            <View style={styles.actionCardText}>
              <Text style={[styles.actionCardTitle, { color: COLORS.danger }]}>Terminar sessao</Text>
              <Text style={styles.actionCardSubtitle}>Sair da sua conta</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>TeOdonto Angola v1.0.0</Text>
        <Text style={styles.copyrightText}>2024 TeOdonto Angola. Todos os direitos reservados.</Text>
      </View>

      <Modal visible={abrirChangePassword} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAbrirChangePassword(false)}>
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Mudar senha</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Senha atual</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.passwordInputField}
                      value={senhaAtual}
                      onChangeText={setSenhaAtual}
                      secureTextEntry={!mostrarSenhaAtual}
                      placeholder="Digite sua senha atual"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity onPress={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}>
                      <Ionicons
                        name={mostrarSenhaAtual ? 'eye' : 'eye-off'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Nova senha</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.passwordInputField}
                      value={novaSenha}
                      onChangeText={setNovaSenha}
                      secureTextEntry={!mostrarNovaSenha}
                      placeholder="Digite sua nova senha"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity onPress={() => setMostrarNovaSenha(!mostrarNovaSenha)}>
                      <Ionicons
                        name={mostrarNovaSenha ? 'eye' : 'eye-off'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Confirmar nova senha</Text>
                  <View style={styles.passwordInput}>
                    <TextInput
                      style={styles.passwordInputField}
                      value={confirmaSenha}
                      onChangeText={setConfirmaSenha}
                      secureTextEntry={!mostrarConfirmaSenha}
                      placeholder="Confirme sua nova senha"
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity onPress={() => setMostrarConfirmaSenha(!mostrarConfirmaSenha)}>
                      <Ionicons
                        name={mostrarConfirmaSenha ? 'eye' : 'eye-off'}
                        size={20}
                        color={COLORS.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setAbrirChangePassword(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary, processando && styles.buttonDisabled]}
                onPress={handleMudarSenha}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator color={COLORS.textInverse} />
                ) : (
                  <Text style={styles.buttonText}>Mudar senha</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={abrirProvincias} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setAbrirProvincias(false)}>
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Selecionar provincia</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              {PROVINCIAS_ADMIN.map((prov) => (
                <TouchableOpacity
                  key={prov}
                  style={[styles.provinciaItem, provincia === prov && styles.provinciaItemAtiva]}
                  onPress={() => {
                    setProvincia(prov);
                    setAbrirProvincias(false);
                  }}
                >
                  <Text
                    style={[
                      styles.provinciaTexto,
                      provincia === prov && styles.provinciaTextoAtiva,
                    ]}
                  >
                    {prov}
                  </Text>
                  {provincia === prov && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

interface InfoCardProps {
  icon: string;
  label: string;
  valor: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, label, valor }) => (
  <View style={styles.infoCard}>
    <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{valor}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  role: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  section: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  form: {
    gap: SPACING.md,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  selectButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
  },
  selectPlaceholder: {
    color: COLORS.textSecondary,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionCardDanger: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  actionCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionCardSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  footer: {
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  versionText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },
  copyrightText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  button: {
    borderRadius: 12,
    paddingVertical: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  buttonSecondaryText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalBody: {
    padding: SPACING.md,
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Math.max(SPACING.md, 20),
    flexDirection: 'row',
    gap: SPACING.md,
  },
  passwordInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInputField: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  provinciaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  provinciaItemAtiva: {
    backgroundColor: COLORS.primaryLight,
  },
  provinciaTexto: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.md,
  },
  provinciaTextoAtiva: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default AdminProfileScreen;
