/**
 * Tela de Recuperacao de Senha do Admin
 * Admin gera senha temporaria e envia por email ao dentista
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { listarDentistas, DentistaProfile } from '../../services/dentistaService';
import { recuperarSenhaDentista } from '../../services/passwordRecoveryService';
import { copiarParaAreaDeTransferencia } from '../../utils/senhaUtils';

const AdminPasswordRecoveryScreen: React.FC = () => {
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [dentistasOrig, setDentistasOrig] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [dentistaSelecionado, setDentistaSelecionado] = useState<DentistaProfile | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [processandoRecuperacao, setProcessandoRecuperacao] = useState(false);

  const carregarDentistas = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const resultado = await listarDentistas({ forceRefresh });
      if (resultado.success && resultado.data) {
        setDentistas(resultado.data);
        setDentistasOrig(resultado.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar dentistas',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao carregar dentistas',
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarDentistas(true);
    }, [])
  );

  const handleBusca = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) {
      const filtrados = dentistasOrig.filter(
        (d) =>
          d.nome?.toLowerCase().includes(texto.toLowerCase()) ||
          d.email?.toLowerCase().includes(texto.toLowerCase())
      );
      setDentistas(filtrados);
      return;
    }
    setDentistas(dentistasOrig);
  };

  const handleRecuperarSenha = async () => {
    if (!dentistaSelecionado) return;

    setProcessandoRecuperacao(true);
    try {
      const resetResult = await recuperarSenhaDentista(
        dentistaSelecionado.id,
        dentistaSelecionado.email || '',
        dentistaSelecionado.nome || ''
      );

      if (resetResult.success && resetResult.novaSenha) {
        setNovaSenha(resetResult.novaSenha);
        await copiarParaAreaDeTransferencia(resetResult.novaSenha);
        if (resetResult.emailSent) {
          Toast.show({
            type: 'success',
            text1: 'Senha enviada',
            text2: 'Senha temporaria enviada por email e copiada no app',
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'Senha gerada',
            text2: resetResult.error || 'Nao foi possivel enviar email; confira configuracao',
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resetResult.error || 'Erro ao recuperar senha',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao recuperar senha',
      });
    } finally {
      setProcessandoRecuperacao(false);
    }
  };

  const handleCopiarSenha = async () => {
    const copiado = await copiarParaAreaDeTransferencia(novaSenha);
    Toast.show({
      type: copiado ? 'success' : 'info',
      text1: copiado ? 'Copiado!' : 'Copia indisponivel',
      text2: copiado
        ? 'Senha copiada para a area de transferencia'
        : 'Copie a senha manualmente',
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarDentistas(true);
    setRefreshing(false);
  };

  const openRecoveryModal = (dentista: DentistaProfile) => {
    setDentistaSelecionado(dentista);
    setNovaSenha('');
    setRecoveryModal(true);
  };

  const closeRecoveryModal = () => {
    setRecoveryModal(false);
    setDentistaSelecionado(null);
    setNovaSenha('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recuperar Senhas</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar dentista..."
            placeholderTextColor={COLORS.textSecondary}
            value={busca}
            onChangeText={handleBusca}
          />
          {busca ? (
            <TouchableOpacity onPress={() => handleBusca('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.danger} />
        </View>
      ) : (
        <FlatList
          data={dentistas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dentistCard}
              onPress={() => openRecoveryModal(item)}
            >
              <View style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.nome?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.nome}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.especialidade}>{item.especialidade}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-remove-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nenhum dentista encontrado</Text>
            </View>
          }
        />
      )}

      <Modal visible={recoveryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeRecoveryModal}>
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Recuperar Senha</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {dentistaSelecionado && (
                <>
                  <View style={styles.dentistInfo}>
                    <View style={[styles.avatar, { width: 80, height: 80 }]}>
                      <Text style={[styles.avatarText, { fontSize: 32 }]}>
                        {dentistaSelecionado.nome?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.dentistName}>{dentistaSelecionado.nome}</Text>
                    <Text style={styles.dentistEmail}>{dentistaSelecionado.email}</Text>
                  </View>

                  {novaSenha ? (
                    <View style={styles.senhaContainer}>
                      <Text style={styles.senhaLabel}>Nova Senha Gerada</Text>
                      <View style={styles.senhaBox}>
                        <Text style={styles.senhaTexto}>{novaSenha}</Text>
                        <TouchableOpacity onPress={handleCopiarSenha}>
                          <Ionicons name="copy" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.senhaInfo}>
                        Esta senha foi enviada por email. No proximo login o dentista sera
                        obrigado a alterar a senha.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.infoBox}>
                      <Ionicons name="information-circle" size={24} color={COLORS.info} />
                      <Text style={styles.infoText}>
                        Clique no botao abaixo para gerar senha temporaria e enviar por email.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              {novaSenha ? (
                <TouchableOpacity
                  style={[styles.button, styles.closeButton]}
                  onPress={closeRecoveryModal}
                >
                  <Text style={styles.buttonText}>Fechar</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.recoveryButton,
                    processandoRecuperacao && styles.buttonDisabled,
                  ]}
                  onPress={handleRecuperarSenha}
                  disabled={processandoRecuperacao}
                >
                  {processandoRecuperacao ? (
                    <ActivityIndicator color={COLORS.textInverse} size="small" />
                  ) : (
                    <>
                      <Ionicons name="key" size={20} color={COLORS.textInverse} />
                      <Text style={styles.buttonText}>Enviar Senha Temporaria</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dentistCard: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  info: { flex: 1 },
  name: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: '600', color: COLORS.text },
  email: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  especialidade: { fontSize: TYPOGRAPHY.sizes.xs, color: COLORS.textSecondary, marginTop: 2 },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: TYPOGRAPHY.sizes.md, color: COLORS.textSecondary, marginTop: SPACING.md },
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
  modalTitle: { fontSize: TYPOGRAPHY.sizes.lg, fontWeight: '700', color: COLORS.text },
  modalBody: { padding: SPACING.md },
  dentistInfo: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dentistName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  dentistEmail: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  senhaContainer: { marginBottom: SPACING.lg },
  senhaLabel: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  senhaBox: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
    marginBottom: SPACING.md,
  },
  senhaTexto: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    color: COLORS.success,
    flex: 1,
    marginRight: SPACING.md,
  },
  senhaInfo: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
  infoBox: {
    backgroundColor: COLORS.info + '20',
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
    marginBottom: SPACING.lg,
  },
  infoText: { flex: 1, fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.text, lineHeight: 20 },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Math.max(SPACING.md, 20),
  },
  button: {
    borderRadius: 12,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recoveryButton: { backgroundColor: COLORS.danger || '#dc3545' },
  closeButton: { backgroundColor: COLORS.primary },
  buttonText: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: '600', color: COLORS.textInverse },
  buttonDisabled: { opacity: 0.6 },
});

export default AdminPasswordRecoveryScreen;


