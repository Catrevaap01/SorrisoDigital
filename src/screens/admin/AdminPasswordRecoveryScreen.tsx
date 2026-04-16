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
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { authService } from '../../services/authService';
import { recuperarSenhaProfissional } from '../../services/passwordRecoveryService';
import { copiarParaAreaDeTransferencia } from '../../utils/senhaUtils';

interface ProfissionalRecovery {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  especialidade?: string;
  tipo?: string;
}

const AdminPasswordRecoveryScreen: React.FC = () => {
  const [profissionais, setProfissionais] = useState<ProfissionalRecovery[]>([]);
  const [profissionaisOrig, setProfissionaisOrig] = useState<ProfissionalRecovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalRecovery | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [processandoRecuperacao, setProcessandoRecuperacao] = useState(false);

  const getTipoLabel = (tipo?: string) => {
    const normalizado = String(tipo || '').toLowerCase();
    if (normalizado === 'secretario') return 'Secretário';
    return 'Dentista';
  };

  const carregarProfissionais = async () => {
    setLoading(true);
    try {
      const resultado = await authService.adminListProfissionais();
      if (resultado.success && resultado.data) {
        setProfissionais(resultado.data as ProfissionalRecovery[]);
        setProfissionaisOrig(resultado.data as ProfissionalRecovery[]);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: 'Erro ao carregar profissionais',
        });
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao carregar profissionais',
      });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarProfissionais();
    }, [])
  );

  const handleBusca = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) {
      const filtrados = profissionaisOrig.filter(
        (d) =>
          d.nome?.toLowerCase().includes(texto.toLowerCase()) ||
          d.email?.toLowerCase().includes(texto.toLowerCase()) ||
          String(d.tipo || '').toLowerCase().includes(texto.toLowerCase())
      );
      setProfissionais(filtrados);
      return;
    }
    setProfissionais(profissionaisOrig);
  };

  const handleRecuperarSenha = async () => {
    if (!profissionalSelecionado) return;

    setProcessandoRecuperacao(true);
    try {
      const resetResult = await recuperarSenhaProfissional(
        profissionalSelecionado.id,
        profissionalSelecionado.email || '',
        profissionalSelecionado.nome || ''
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
    await carregarProfissionais();
    setRefreshing(false);
  };

  const openRecoveryModal = (profissional: ProfissionalRecovery) => {
    setProfissionalSelecionado(profissional);
    setNovaSenha('');
    setRecoveryModal(true);
  };

  const closeRecoveryModal = () => {
    setRecoveryModal(false);
    setProfissionalSelecionado(null);
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
        <View style={Platform.OS === 'web' && styles.headerContent}>
          <Text style={styles.title}>Recuperar Senhas</Text>
          <View style={[
            styles.searchContainer,
            Platform.OS === 'web' && { flex: 1, marginLeft: SPACING.xl }
          ]}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar dentista ou secretário..."
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
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.danger} />
        </View>
      ) : (
        <FlatList
          data={profissionais}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            Platform.OS === 'web' && styles.webListContent
          ]}
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
                  <Text style={styles.especialidade}>
                    {getTipoLabel(item.tipo)}
                    {item.especialidade ? ` • ${item.especialidade}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-remove-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nenhum profissional encontrado</Text>
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
              {profissionalSelecionado && (
                <>
                  <View style={styles.dentistInfo}>
                    <View style={[styles.avatar, { width: 80, height: 80 }]}>
                      <Text style={[styles.avatarText, { fontSize: 32 }]}>
                        {profissionalSelecionado.nome?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.dentistName}>{profissionalSelecionado.nome}</Text>
                    <Text style={styles.dentistEmail}>{profissionalSelecionado.email}</Text>
                    <Text style={styles.especialidade}>
                      {getTipoLabel(profissionalSelecionado.tipo)}
                      {profissionalSelecionado.especialidade ? ` • ${profissionalSelecionado.especialidade}` : ''}
                    </Text>
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
                        Esta senha foi enviada por email. No proximo login o utilizador sera
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
  headerContent: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
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
    ...SHADOWS.sm,
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
  listContent: { paddingVertical: SPACING.md },
  webListContent: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: TYPOGRAPHY.sizes.md, color: COLORS.textSecondary, marginTop: SPACING.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    width: '100%',
    alignSelf: 'center',
    maxHeight: Platform.OS === 'web' ? '80%' : '90%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
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
  modalBody: { 
    padding: SPACING.md,
    flexShrink: 1,
  },
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

