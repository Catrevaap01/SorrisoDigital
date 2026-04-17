import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SHADOWS, SIZES, TYPOGRAPHY } from '../../styles/theme';

const PROVINCIAS_ADMIN = [
  'Luanda', 'Benguela', 'Huambo', 'Huila', 'Bie', 'Malanje', 'Uige', 'Zaire',
  'Cabinda', 'Cunene', 'Cuando Cubango', 'Cuanza Norte', 'Cuanza Sul',
  'Lunda Norte', 'Lunda Sul', 'Moxico', 'Namibe', 'Bengo',
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
  const [twoStepEnabled, setTwoStepEnabled] = useState(profile?.two_step_enabled || false);

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
      setTwoStepEnabled(profile?.two_step_enabled || false);
    }, [profile])
  );

  const handleSalvarAlteracoes = async () => {
    if (!nome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome é obrigatório' });
      return;
    }

    setProcessando(true);
    const resultado = await updateProfile({ nome, telefone, provincia: provincia.trim() });

    if (resultado.success) {
      setEditando(false);
      Toast.show({
        type: 'success',
        text1: 'Perfil atualizado',
        text2: 'Seus dados foram salvos com sucesso',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro ao atualizar',
        text2: resultado.error?.message || 'Tente novamente mais tarde',
      });
    }
    setProcessando(false);
  };

  const handleMudarSenha = async () => {
    if (!senhaAtual.trim() || !novaSenha.trim()) {
      Toast.show({ type: 'error', text1: 'Preencha todos os campos de senha' });
      return;
    }
    if (novaSenha.length < 6) {
      Toast.show({ type: 'error', text1: 'Nova senha muito curta', text2: 'Mínimo de 6 caracteres' });
      return;
    }
    if (novaSenha !== confirmaSenha) {
      Toast.show({ type: 'error', text1: 'As senhas não coincidem' });
      return;
    }

    setProcessando(true);
    // Simulação de mudança de senha (geralmente via Supabase Auth RPC ou API)
    setTimeout(() => {
      Toast.show({ type: 'info', text1: 'Funcionalidade em manutenção', text2: 'Contate o suporte técnico' });
      setProcessando(false);
    }, 1500);
  };

  const handleToggleTwoStep = async () => {
    const novoEstado = !twoStepEnabled;
    setProcessando(true);
    const result = await updateProfile({ two_step_enabled: novoEstado });
    
    if (result.success) {
      setTwoStepEnabled(novoEstado);
      Toast.show({
        type: 'success',
        text1: 'Verificação atualizada',
        text2: novoEstado ? 'Proteção 2FA ativada' : 'Proteção 2FA desativada',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro ao atualizar 2FA',
        text2: result.error?.message || 'Erro desconhecido',
      });
    }
    setProcessando(false);
  };

  const handleLogout = () => {
    signOut();
  };

  const avatarInitial = profile?.nome?.charAt(0).toUpperCase() || 'A';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Elegante */}
        <View style={styles.headerBackground}>
          <View style={styles.headerForeground}>
            <View style={styles.avatarGlow}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarTextLarge}>{avatarInitial}</Text>
              </View>
            </View>
            <Text style={styles.profileName}>{profile?.nome || 'Administrador'}</Text>
            <View style={styles.badgeAdmin}>
              <Ionicons name="shield-checkmark" size={14} color="white" />
              <Text style={styles.badgeText}>CONTA ADMINISTRADOR</Text>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Card Principal de Informações */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Informações Pessoais</Text>
              <TouchableOpacity 
                onPress={() => setEditando(!editando)}
                style={[styles.editBtn, editando && styles.editBtnActive]}
              >
                <Ionicons 
                  name={editando ? "close" : "pencil"} 
                  size={18} 
                  color={editando ? COLORS.danger : COLORS.primary} 
                />
                <Text style={[styles.editBtnText, editando && { color: COLORS.danger }]}>
                  {editando ? "Cancelar" : "Editar"}
                </Text>
              </TouchableOpacity>
            </View>

            {editando ? (
              <View style={styles.editForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOME COMPLETO</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.textInput}
                      value={nome}
                      onChangeText={setNome}
                      placeholder="Nome do administrador"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TELEFONE</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.textInput}
                      value={telefone}
                      onChangeText={setTelefone}
                      placeholder="+244"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PROVÍNCIA</Text>
                  <TouchableOpacity style={styles.selectWrapper} onPress={() => setAbrirProvincias(true)}>
                    <View style={styles.selectInner}>
                      <Ionicons name="location-outline" size={20} color={COLORS.textSecondary} />
                      <Text style={styles.selectValue}>{provincia || 'Selecione'}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, processando && styles.disabledBtn]}
                  onPress={handleSalvarAlteracoes}
                  disabled={processando}
                >
                  {processando ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.saveBtnText}>Salvar Alterações</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoList}>
                <InfoItem icon="mail-outline" label="Email de acesso" value={profile?.email || '---'} color="#3B82F6" />
                <InfoItem icon="call-outline" label="Telefone de contato" value={profile?.telefone || '---'} color="#10B981" />
                <InfoItem icon="location-outline" label="Província atual" value={profile?.provincia || '---'} color="#F59E0B" />
                <InfoItem 
                  icon="calendar-outline" 
                  label="Conta criada em" 
                  value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-PT') : '---'} 
                  color="#8B5CF6" 
                />
              </View>
            )}
          </View>

          {/* Seção de Segurança */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Segurança e Privacidade</Text>
            <TouchableOpacity style={styles.actionRow} onPress={() => setAbrirChangePassword(true)}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFF7ED' }]}>
                <Ionicons name="key-outline" size={20} color="#F97316" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Mudar Senha</Text>
                <Text style={styles.actionSubtitle}>Atualize sua credencial de acesso</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            
            <View style={styles.divider} />

            <TouchableOpacity style={styles.actionRow} onPress={handleToggleTwoStep} disabled={processando}>
              <View style={[styles.actionIcon, { backgroundColor: twoStepEnabled ? '#ECFDF5' : '#F1F5F9' }]}>
                <Ionicons 
                  name={twoStepEnabled ? "shield-checkmark-outline" : "shield-outline"} 
                  size={20} 
                  color={twoStepEnabled ? COLORS.success : COLORS.textSecondary} 
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Verificação Duas Etapas</Text>
                <Text style={styles.actionSubtitle}>
                  {twoStepEnabled ? 'Sua conta está mais protegida' : 'Recomendado para sua segurança'}
                </Text>
              </View>
              <View style={[styles.statusToggle, twoStepEnabled && styles.statusToggleActive]}>
                <View style={[styles.statusDot, twoStepEnabled && styles.statusDotActive]} />
              </View>
              <Text style={[styles.statusBadge, twoStepEnabled && { color: COLORS.success, backgroundColor: '#ECFDF5' }]}>
                {twoStepEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
            <Text style={styles.logoutText}>Encerrar Sessão</Text>
          </TouchableOpacity>

          <View style={styles.footerInfo}>
            <Text style={styles.versionLabel}>TeOdonto Angola v1.2.4</Text>
            <Text style={styles.copyrightLabel}>© 2026 Sorriso Digital. Todos os direitos reservados.</Text>
          </View>
        </View>

        {/* Modais Modernos */}
        <Modal visible={abrirProvincias} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Escolher Província</Text>
                <TouchableOpacity onPress={() => setAbrirProvincias(false)}>
                  <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalList}>
                {PROVINCIAS_ADMIN.map(p => (
                  <TouchableOpacity 
                    key={p} 
                    style={[styles.modalItem, p === provincia && styles.modalItemSelected]}
                    onPress={() => { setProvincia(p); setAbrirProvincias(false); }}
                  >
                    <Text style={[styles.modalItemText, p === provincia && styles.modalItemTextSelected]}>{p}</Text>
                    {p === provincia && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={abrirChangePassword} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Alterar Password</Text>
                <TouchableOpacity onPress={() => setAbrirChangePassword(false)}>
                  <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <PasswordInput label="SENHA ATUAL" value={senhaAtual} onChange={setSenhaAtual} visible={mostrarSenhaAtual} onToggle={() => setMostrarSenhaAtual(!mostrarSenhaAtual)} />
                <PasswordInput label="NOVA SENHA" value={novaSenha} onChange={setNovaSenha} visible={mostrarNovaSenha} onToggle={() => setMostrarNovaSenha(!mostrarNovaSenha)} />
                <PasswordInput label="CONFIRMAR NOVA SENHA" value={confirmaSenha} onChange={setConfirmaSenha} visible={mostrarConfirmaSenha} onToggle={() => setMostrarConfirmaSenha(!mostrarConfirmaSenha)} />
                
                <TouchableOpacity 
                  style={[styles.saveBtn, { marginTop: 20 }, processando && styles.disabledBtn]}
                  onPress={handleMudarSenha}
                  disabled={processando}
                >
                  {processando ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>Atualizar Password</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Componentes Auxiliares
const InfoItem = ({ icon, label, value, color }: any) => (
  <View style={styles.infoItem}>
    <View style={[styles.infoIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={styles.infoContentWrap}>
      <Text style={styles.infoLabelText}>{label}</Text>
      <Text style={styles.infoValueText}>{value}</Text>
    </View>
  </View>
);

const PasswordInput = ({ label, value, onChange, visible, onToggle }: any) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      <TextInput
        style={[styles.textInput, { flex: 1 }]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!visible}
        placeholder="••••••••"
      />
      <TouchableOpacity onPress={onToggle}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingBottom: 40 },
  
  // Header
  headerBackground: {
    backgroundColor: 'white',
    height: 180,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerForeground: { position: 'absolute', bottom: -50, alignItems: 'center', width: '100%' },
  avatarGlow: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: 'white',
    ...SHADOWS.lg,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  avatarTextLarge: { fontSize: 42, fontWeight: '700', color: 'white' },
  profileName: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 12 },
  badgeAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 6,
    gap: 6,
  },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Content
  mainContent: { marginTop: 70, paddingHorizontal: 20, gap: 20 },
  card: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 15 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
  editBtnActive: { backgroundColor: '#FEF2F2' },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  // Info Items
  infoList: { gap: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 18 },
  infoIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoContentWrap: { flex: 1 },
  infoLabelText: { fontSize: TYPOGRAPHY.sizes.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValueText: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 2 },

  // Edit Form
  editForm: { gap: 18 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 15, paddingHorizontal: 15, paddingVertical: Platform.OS === 'ios' ? 14 : 4, gap: 10 },
  textInput: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  selectWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F1F5F9', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 14 },
  selectInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectValue: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 18, alignItems: 'center', ...SHADOWS.md },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },

  // Action Rows
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 10 },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  actionSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  statusBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, color: COLORS.textSecondary, fontSize: 11, fontWeight: '900', marginLeft: 10 },
  statusToggle: { width: 34, height: 18, borderRadius: 10, backgroundColor: '#CBD5E1', padding: 2 },
  statusToggleActive: { backgroundColor: COLORS.success },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'white' },
  statusDotActive: { transform: [{ translateX: 16 }] },

  // Logout
  logoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FEF2F2', paddingVertical: 16, borderRadius: 20, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },

  // Footer
  footerInfo: { alignItems: 'center', marginTop: 10 },
  versionLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  copyrightLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 5 },

  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, height: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  modalList: { flex: 1 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalItemSelected: { backgroundColor: '#EFF6FF', marginHorizontal: -25, paddingHorizontal: 25 },
  modalItemText: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  modalItemTextSelected: { color: COLORS.primary, fontWeight: '700' },
  modalBody: { gap: 20 },
});

export default AdminProfileScreen;
