/**
 * Profile Edit Modal Component
 * Componente reutilizável para editar perfil de usuário
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../styles/theme';
import { PROVINCIAS_ANGOLA, ESPECIALIDADES_DENTISTA, ESPECIALIDADES_POR_PROVINCIA } from '../utils/constants';
import { UserProfile } from '../contexts/AuthContext';

interface ProfileEditModalProps {
  visible: boolean;
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
  loading?: boolean;
  campos?: Array<'nome' | 'telefone' | 'provincia' | 'data_nascimento' | 'genero' | 'especialidade'>;
}

const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  visible,
  profile,
  onClose,
  onSave,
  loading = false,
  campos = ['nome', 'telefone', 'provincia'],
}) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [provincia, setProvincia] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [genero, setGenero] = useState('');
  const [showProvincias, setShowProvincias] = useState(false);
  const [showEspecialidades, setShowEspecialidades] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || '');
      setTelefone(profile.telefone || '');
      setProvincia(profile.provincia || '');
      setEspecialidade(profile.especialidade || '');
      setDataNascimento(profile.data_nascimento || '');
      setGenero(profile.genero || '');
    }
  }, [visible, profile]);

  const handleSave = async () => {
    const updates: Partial<UserProfile> = {};

    if (campos.includes('nome')) updates.nome = nome;
    if (campos.includes('telefone')) updates.telefone = telefone;
    if (campos.includes('provincia')) updates.provincia = provincia;
    if (campos.includes('especialidade')) updates.especialidade = especialidade;
    if (campos.includes('data_nascimento')) updates.data_nascimento = dataNascimento;
    if (campos.includes('genero')) updates.genero = genero;

    await onSave(updates);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Editar Perfil</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {campos.includes('nome') && (
              <View style={styles.field}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Seu nome completo"
                  editable={!loading}
                />
              </View>
            )}

            {campos.includes('telefone') && (
              <View style={styles.field}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="923 456 789"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
            )}

            {campos.includes('provincia') && (
              <View style={styles.field}>
                <Text style={styles.label}>Província</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowProvincias(true)}
                  disabled={loading}
                >
                  <Text style={[styles.selectText, !provincia && styles.placeholder]}>
                    {provincia || 'Selecione'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>

                {/* Modal de Províncias */}
                <Modal
                  visible={showProvincias}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowProvincias(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Selecione a Província</Text>
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
                              // limpa especialidade caso não esteja disponível na província selecionada
                              const lista = ESPECIALIDADES_POR_PROVINCIA[prov] || ESPECIALIDADES_DENTISTA;
                              if (!lista.includes(especialidade)) {
                                setEspecialidade('');
                              }
                              setShowProvincias(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.provinciaText,
                                provincia === prov && styles.provinciaTextActive,
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

                {/* Modal de Especialidades */}
                <Modal
                  visible={showEspecialidades}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowEspecialidades(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Selecione a Especialidade</Text>
                        <TouchableOpacity onPress={() => setShowEspecialidades(false)}>
                          <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView>
                        {(ESPECIALIDADES_POR_PROVINCIA[provincia] || ESPECIALIDADES_DENTISTA).map((esp) => (
                          <TouchableOpacity
                            key={esp}
                            style={[
                              styles.provinciaItem,
                              especialidade === esp && styles.provinciaItemActive,
                            ]}
                            onPress={() => {
                              setEspecialidade(esp);
                              setShowEspecialidades(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.provinciaText,
                                especialidade === esp && styles.provinciaTextActive,
                              ]}
                            >
                              {esp}
                            </Text>
                            {especialidade === esp && (
                              <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              </View>
            )}

            {campos.includes('data_nascimento') && (
              <View style={styles.field}>
                <Text style={styles.label}>Data de Nascimento</Text>
                <TextInput
                  style={styles.input}
                  value={dataNascimento}
                  onChangeText={setDataNascimento}
                  placeholder="YYYY-MM-DD"
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
            )}

            {campos.includes('genero') && (
              <View style={styles.field}>
                <Text style={styles.label}>Gênero</Text>
                <View style={styles.generoContainer}>
                  {['Masculino', 'Feminino', 'Outro'].map((opcao) => (
                    <TouchableOpacity
                      key={opcao}
                      style={[
                        styles.generoButton,
                        genero === opcao && styles.generoButtonActive,
                      ]}
                      onPress={() => setGenero(opcao)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.generoButtonText,
                          genero === opcao && styles.generoButtonTextActive,
                        ]}
                      >
                        {opcao}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusXl,
    width: '90%',
    maxHeight: '90%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SIZES.md,
  },
  field: {
    marginBottom: SIZES.lg,
  },
  label: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 8,
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
  placeholder: {
    color: COLORS.textLight,
  },
  generoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SIZES.sm,
  },
  generoButton: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  generoButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  generoButtonText: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
  },
  generoButtonTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
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
  provinciaText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  provinciaTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.md,
    gap: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  button: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    backgroundColor: COLORS.primaryLight,
  },
});

export default ProfileEditModal;
