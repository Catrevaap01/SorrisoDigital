import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { PROFILE_SCHEMA_FEATURES } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { PROVINCIAS_ANGOLA } from '../../utils/constants';
import { getInitials, formatDate } from '../../utils/helpers';

const PerfilScreen: React.FC = () => {
  const { profile, updateProfile, signOut, loading } = useAuth();
  const [editando, setEditando] = useState<boolean>(false);
  const [showProvincias, setShowProvincias] = useState<boolean>(false);
  const canEditProvincia =
    PROFILE_SCHEMA_FEATURES.hasProvincia || PROFILE_SCHEMA_FEATURES.usesProvinciaId;
  
  // Campos editÃ¡veis
  const [nome, setNome] = useState<string>(profile?.nome || '');
  const [telefone, setTelefone] = useState<string>(profile?.telefone || '');
  const [provincia, setProvincia] = useState<string>(profile?.provincia || '');

  useEffect(() => {
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setProvincia(profile?.provincia || '');
  }, [profile]);

  const handleSalvar = async () => {
    const updates: Record<string, string> = {
      nome: nome.trim(),
      telefone: telefone.trim(),
    };

    if (canEditProvincia) {
      updates.provincia = provincia;
    }

    const result = await updateProfile(updates);

    if (result.success) {
      setEditando(false);
    }
  };

  const handleCancelar = () => {
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setProvincia(profile?.provincia || '');
    setEditando(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const isDentista = profile?.tipo === 'dentista' || profile?.tipo === 'medico';

  return (
    <ScrollView style={styles.container}>
      {/* Header do Perfil */}
      <View style={[styles.header, isDentista && styles.headerDentista]}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{getInitials(profile?.nome)}</Text>
        </View>
        <Text style={styles.headerNome}>{profile?.nome || 'UsuÃ¡rio'}</Text>
        <Text style={styles.headerEmail}>{profile?.email}</Text>
        <View style={styles.tipoBadge}>
          <Ionicons 
            name={isDentista ? 'medical' : 'person'} 
            size={14} 
            color={isDentista ? COLORS.secondary : COLORS.primary} 
          />
          <Text style={[styles.tipoText, isDentista && styles.tipoTextDentista]}>
            {isDentista ? 'Dentista' : 'Paciente'}
          </Text>
        </View>
      </View>

      {/* InformaÃ§Ãµes Pessoais */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>InformaÃ§Ãµes Pessoais</Text>
          <TouchableOpacity onPress={() => setEditando(!editando)}>
            <Ionicons
              name={editando ? 'close' : 'create-outline'}
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Nome */}
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Nome</Text>
          {editando ? (
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome completo"
            />
          ) : (
            <Text style={styles.campoValor}>{profile?.nome || '-'}</Text>
          )}
        </View>

        {/* Email (nÃ£o editÃ¡vel) */}
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Email</Text>
          <Text style={styles.campoValor}>{profile?.email || '-'}</Text>
        </View>

        {/* Telefone */}
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Telefone</Text>
          {editando ? (
            <TextInput
              style={styles.input}
              value={telefone}
              onChangeText={setTelefone}
              placeholder="923 456 789"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.campoValor}>{profile?.telefone || '-'}</Text>
          )}
        </View>

        {canEditProvincia && (
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Província</Text>
            {editando ? (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowProvincias(true)}
              >
                <Text style={[styles.selectText, !provincia && styles.selectPlaceholder]}>
                  {provincia || 'Selecione'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.campoValor}>{profile?.provincia || '-'}</Text>
            )}
          </View>
        )}

        {/* Membro desde */}
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Membro desde</Text>
          <Text style={styles.campoValor}>
            {profile?.created_at ? formatDate(profile.created_at, 'MMMM yyyy') : '-'}
          </Text>
        </View>

        {/* BotÃµes de EdiÃ§Ã£o */}
        {editando && (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={handleCancelar}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editButton, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSalvar}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* InformaÃ§Ãµes do Dentista */}
      {isDentista && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>InformaÃ§Ãµes Profissionais</Text>
          
          <View style={styles.campo}>
            <Text style={styles.campoLabel}>CRO</Text>
            <Text style={styles.campoValor}>{profile?.cro || '-'}</Text>
          </View>

          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Especialidade</Text>
            <Text style={styles.campoValor}>{profile?.especialidade || '-'}</Text>
          </View>
        </View>
      )}

      {/* OpÃ§Ãµes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ConfiguraÃ§Ãµes</Text>

        <TouchableOpacity style={styles.opcaoItem}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
          <Text style={styles.opcaoText}>NotificaÃ§Ãµes</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.opcaoItem}>
          <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.textSecondary} />
          <Text style={styles.opcaoText}>Privacidade</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.opcaoItem}>
          <Ionicons name="help-circle-outline" size={22} color={COLORS.textSecondary} />
          <Text style={styles.opcaoText}>Ajuda</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.opcaoItem}>
          <Ionicons name="document-text-outline" size={22} color={COLORS.textSecondary} />
          <Text style={styles.opcaoText}>Termos de Uso</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>

      {/* BotÃ£o Sair */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      {/* VersÃ£o */}
      <Text style={styles.versao}>TeOdonto Angola v1.0.0</Text>

      {/* Modal de ProvÃ­ncias */}
      <Modal
        visible={showProvincias}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProvincias(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione a ProvÃ­ncia</Text>
              <TouchableOpacity onPress={() => setShowProvincias(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {PROVINCIAS_ANGOLA.map((prov) => (
                <TouchableOpacity
                  key={prov}
                  style={[
                    styles.provinciaItem,
                    provincia === prov && styles.provinciaItemActive,
                  ]}
                  onPress={() => {
                    setProvincia(prov);
                    setShowProvincias(false);
                  }}
                >
                  <Text
                    style={[
                      styles.provinciaItemText,
                      provincia === prov && styles.provinciaItemTextActive,
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

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    paddingHorizontal: SIZES.md,
  },
  headerDentista: {
    backgroundColor: COLORS.secondary,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textInverse,
  },
  headerNome: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.textInverse,
  },
  headerEmail: {
    fontSize: SIZES.fontMd,
    color: COLORS.textInverse,
    opacity: 0.8,
    marginTop: 2,
  },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusFull,
    marginTop: SIZES.md,
  },
  tipoText: {
    marginLeft: SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  tipoTextDentista: {
    color: COLORS.secondary,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    padding: SIZES.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  sectionTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  campo: {
    marginBottom: SIZES.md,
  },
  campoLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  campoValor: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  selectPlaceholder: {
    color: COLORS.textLight,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.md,
  },
  editButton: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    marginRight: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    marginLeft: SIZES.sm,
  },
  saveButtonText: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: COLORS.primaryLight,
  },
  opcaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  opcaoText: {
    flex: 1,
    marginLeft: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    padding: SIZES.md,
  },
  logoutText: {
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.danger,
  },
  versao: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: SIZES.fontSm,
    marginTop: SIZES.lg,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  provinciaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  provinciaItemActive: {
    backgroundColor: '#E3F2FD',
  },
  provinciaItemText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  provinciaItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default PerfilScreen;

