/**
 * Tela de Recuperacao e Redefinicao de Senha do Admin
 * Permite ao admin:
 *  1. Ver a senha temporaria/anterior do dentista ou secretario (com toggle de visibilidade e copia)
 *  2. Redefinir a senha (gerando automaticamente ou digitando manualmente)
 *  3. Enviar a nova senha para o email real do profissional e via WhatsApp
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { authService } from '../../services/authService';
import { recuperarSenhaProfissional, gerarSenhaAleatoria } from '../../services/passwordRecoveryService';
import { buildPasswordRecoveryMailto, buildPasswordRecoveryWhatsApp } from '../../services/emailService';
import { copiarParaAreaDeTransferencia } from '../../utils/senhaUtils';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface ProfissionalRecovery {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  especialidade?: string;
  tipo?: string;
  temp_password?: string | null;
  senha_alterada?: boolean | null;
  updated_at?: string;
}

const AdminPasswordRecoveryScreen: React.FC = () => {
  const [profissionais, setProfissionais] = useState<ProfissionalRecovery[]>([]);
  const [profissionaisOrig, setProfissionaisOrig] = useState<ProfissionalRecovery[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  // Modal de Recuperação / Redefinição
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<ProfissionalRecovery | null>(null);

  // Visualização da Senha Anterior
  const [mostrarSenhaAnterior, setMostrarSenhaAnterior] = useState(false);

  // Redefinição de Nova Senha
  const [novaSenhaInput, setNovaSenhaInput] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);

  // Resultado do Processamento
  const [senhaRedefinida, setSenhaRedefinida] = useState('');
  const [emailEnviadoStatus, setEmailEnviadoStatus] = useState<boolean | null>(null);
  const [processando, setProcessando] = useState(false);

  const getTipoLabel = (tipo?: string) => {
    const normalizado = String(tipo || '').toLowerCase();
    if (normalizado === 'secretario') return 'Secretário';
    return 'Dentista';
  };

  const getTipoColor = (tipo?: string) => {
    const normalizado = String(tipo || '').toLowerCase();
    if (normalizado === 'secretario') return '#10B981'; // Verde
    return COLORS.primary; // Azul
  };

  const carregarProfissionais = useCallback(async () => {
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarProfissionais();
    }, [carregarProfissionais])
  );

  useRealtimeRefresh({
    enabled: true,
    debounceMs: 1500,
    shouldRefresh: (event) => event.table === 'profiles',
    refresh: () => {
      void carregarProfissionais();
    },
  });

  const handleBusca = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) {
      const filtrados = profissionaisOrig.filter(
        (d) =>
          d.nome?.toLowerCase().includes(texto.toLowerCase()) ||
          d.email?.toLowerCase().includes(texto.toLowerCase()) ||
          String(d.tipo || '').toLowerCase().includes(texto.toLowerCase()) ||
          d.especialidade?.toLowerCase().includes(texto.toLowerCase())
      );
      setProfissionais(filtrados);
      return;
    }
    setProfissionais(profissionaisOrig);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarProfissionais();
    setRefreshing(false);
  };

  const openRecoveryModal = (profissional: ProfissionalRecovery) => {
    setProfissionalSelecionado(profissional);
    setMostrarSenhaAnterior(false);
    setNovaSenhaInput('');
    setMostrarNovaSenha(false);
    setSenhaRedefinida('');
    setEmailEnviadoStatus(null);
    setRecoveryModal(true);
  };

  const closeRecoveryModal = () => {
    setRecoveryModal(false);
    setProfissionalSelecionado(null);
    setMostrarSenhaAnterior(false);
    setNovaSenhaInput('');
    setMostrarNovaSenha(false);
    setSenhaRedefinida('');
    setEmailEnviadoStatus(null);
  };

  const handleGerarSenhaAutomatica = () => {
    const s = gerarSenhaAleatoria(10);
    setNovaSenhaInput(s);
    setMostrarNovaSenha(true);
  };

  const handleCopiarTexto = async (texto: string, label: string) => {
    if (!texto) return;
    const copiado = await copiarParaAreaDeTransferencia(texto);
    Toast.show({
      type: copiado ? 'success' : 'info',
      text1: copiado ? `${label} copiada!` : 'Cópia indisponível',
      text2: copiado ? 'Copiada para a área de transferência' : 'Copie o texto manualmente',
    });
  };

  const handleRedefinirSenha = async () => {
    if (!profissionalSelecionado) return;

    const senhaParaUsar = novaSenhaInput.trim();
    if (senhaParaUsar && senhaParaUsar.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Senha muito curta',
        text2: 'A nova senha deve ter no mínimo 6 caracteres.',
      });
      return;
    }

    setProcessando(true);
    try {
      const resetResult = await recuperarSenhaProfissional(
        profissionalSelecionado.id,
        profissionalSelecionado.email || '',
        profissionalSelecionado.nome || '',
        senhaParaUsar || undefined
      );

      if (resetResult.success && resetResult.novaSenha) {
        setSenhaRedefinida(resetResult.novaSenha);
        setEmailEnviadoStatus(resetResult.emailSent ?? false);

        // Copia a nova senha automaticamente
        await copiarParaAreaDeTransferencia(resetResult.novaSenha);

        // Atualiza a lista em memória
        setProfissionais((prev) =>
          prev.map((p) =>
            p.id === profissionalSelecionado.id
              ? { ...p, temp_password: resetResult.novaSenha, senha_alterada: false }
              : p
          )
        );
        setProfissionaisOrig((prev) =>
          prev.map((p) =>
            p.id === profissionalSelecionado.id
              ? { ...p, temp_password: resetResult.novaSenha, senha_alterada: false }
              : p
          )
        );

        // Atualiza profissional selecionado
        setProfissionalSelecionado((prev) =>
          prev ? { ...prev, temp_password: resetResult.novaSenha, senha_alterada: false } : null
        );

        Toast.show({
          type: 'success',
          text1: 'Senha redefinida com sucesso!',
          text2: resetResult.emailSent
            ? 'Enviada para o e-mail real e copiada para a área de transferência.'
            : 'Senha copiada! Também pode enviar por E-mail ou WhatsApp abaixo.',
          visibilityTime: 5000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao redefinir senha',
          text2: resetResult.error || 'Não foi possível redefinir a senha.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: err?.message || 'Falha ao processar redefinição.',
      });
    } finally {
      setProcessando(false);
    }
  };

  const handleAbrirEmailCliente = async () => {
    if (!profissionalSelecionado || !senhaRedefinida) return;
    const url = buildPasswordRecoveryMailto(
      profissionalSelecionado.email || '',
      profissionalSelecionado.nome || '',
      senhaRedefinida
    );
    try {
      await Linking.openURL(url);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erro ao abrir cliente de e-mail',
        text2: 'Copie a senha manualmente.',
      });
    }
  };

  const handleEnviarWhatsApp = async () => {
    if (!profissionalSelecionado?.telefone || !senhaRedefinida) {
      Toast.show({
        type: 'info',
        text1: 'Sem telefone registado',
        text2: 'Este profissional não tem número de telefone no perfil.',
      });
      return;
    }
    const url = buildPasswordRecoveryWhatsApp(
      profissionalSelecionado.telefone,
      profissionalSelecionado.nome || '',
      senhaRedefinida
    );
    try {
      await Linking.openURL(url);
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Erro ao abrir WhatsApp',
        text2: 'Verifique se o aplicativo do WhatsApp está instalado.',
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View style={Platform.OS === 'web' ? styles.headerContentWeb : styles.headerContent}>
            <View>
              <Text style={styles.title}>Recuperar & Redefinir Senhas</Text>
              <Text style={styles.subtitleHeader}>
                Consulte a senha anterior ou redefina enviando para o e-mail real
              </Text>
            </View>
            <View style={[styles.searchContainer, Platform.OS === 'web' && styles.searchContainerWeb]}>
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

        {/* Lista de Profissionais */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Carregando profissionais...</Text>
          </View>
        ) : (
          <FlatList
            data={profissionais}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              Platform.OS === 'web' && styles.webListContent,
            ]}
            renderItem={({ item }) => {
              const tipoColor = getTipoColor(item.tipo);
              const temSenhaAnterior = Boolean(item.temp_password);

              return (
                <TouchableOpacity
                  style={styles.dentistCard}
                  onPress={() => openRecoveryModal(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardContent}>
                    {/* Avatar */}
                    <View style={[styles.avatar, { backgroundColor: tipoColor }]}>
                      <Text style={styles.avatarText}>
                        {item.nome?.charAt(0).toUpperCase() || 'P'}
                      </Text>
                    </View>

                    {/* Informações */}
                    <View style={styles.info}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name} numberOfLines={1}>{item.nome}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: tipoColor + '18' }]}>
                          <Text style={[styles.roleBadgeText, { color: tipoColor }]}>
                            {getTipoLabel(item.tipo)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.email} numberOfLines={1}>{item.email}</Text>

                      {item.especialidade ? (
                        <Text style={styles.especialidadeText} numberOfLines={1}>
                          <Ionicons name="medkit-outline" size={13} color={COLORS.textSecondary} />{' '}
                          {item.especialidade}
                        </Text>
                      ) : null}

                      {/* Badge de Senha */}
                      <View style={styles.passwordStatusRow}>
                        {temSenhaAnterior ? (
                          <View style={styles.badgeSenhaDisponivel}>
                            <Ionicons name="key" size={13} color="#B45309" />
                            <Text style={styles.badgeSenhaDisponivelText}>
                              Senha anterior: •••••••• (toque para ver)
                            </Text>
                          </View>
                        ) : item.senha_alterada ? (
                          <View style={styles.badgeSenhaAlterada}>
                            <Ionicons name="checkmark-circle" size={13} color="#059669" />
                            <Text style={styles.badgeSenhaAlteradaText}>
                              Senha personalizada pelo usuário
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.badgeSenhaNaoRegistada}>
                            <Ionicons name="help-circle-outline" size={13} color="#64748B" />
                            <Text style={styles.badgeSenhaNaoRegistadaText}>
                              Toque para redefinir senha
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
                  </View>
                </TouchableOpacity>
              );
            }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="person-remove-outline" size={54} color={COLORS.textSecondary} />
                <Text style={styles.emptyTitle}>Nenhum profissional encontrado</Text>
                <Text style={styles.emptySubtitle}>Tente outro termo de busca ou adicione novos profissionais.</Text>
              </View>
            }
          />
        )}

        {/* Modal de Recuperação / Redefinição */}
        <Modal
          visible={recoveryModal}
          animationType="slide"
          transparent
          onRequestClose={closeRecoveryModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Topo do Modal */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={closeRecoveryModal}
                  style={styles.modalBackButton}
                  accessibilityLabel="Voltar"
                >
                  <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Recuperar & Redefinir Senha</Text>
                <TouchableOpacity onPress={closeRecoveryModal} style={styles.modalCloseButton}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {profissionalSelecionado && (
                  <>
                    {/* Perfil do Profissional */}
                    <View style={styles.dentistInfo}>
                      <View
                        style={[
                          styles.avatar,
                          { width: 72, height: 72, borderRadius: 36, backgroundColor: getTipoColor(profissionalSelecionado.tipo) },
                        ]}
                      >
                        <Text style={[styles.avatarText, { fontSize: 30 }]}>
                          {profissionalSelecionado.nome?.charAt(0).toUpperCase() || 'P'}
                        </Text>
                      </View>
                      <Text style={styles.dentistName}>{profissionalSelecionado.nome}</Text>
                      <Text style={styles.dentistEmail}>{profissionalSelecionado.email}</Text>

                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.roleBadge,
                            { backgroundColor: getTipoColor(profissionalSelecionado.tipo) + '18', paddingHorizontal: 10, paddingVertical: 4 },
                          ]}
                        >
                          <Text style={[styles.roleBadgeText, { color: getTipoColor(profissionalSelecionado.tipo) }]}>
                            {getTipoLabel(profissionalSelecionado.tipo)}
                            {profissionalSelecionado.especialidade ? ` • ${profissionalSelecionado.especialidade}` : ''}
                          </Text>
                        </View>
                        {profissionalSelecionado.telefone ? (
                          <View style={styles.phoneBadge}>
                            <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
                            <Text style={styles.phoneBadgeText}>{profissionalSelecionado.telefone}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* SEÇÃO 1: SENHA ANTERIOR (SE EXISTIR OU AVISO) */}
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="time" size={18} color="#D97706" />
                        <Text style={styles.sectionTitle}>Senha Anterior / Registada</Text>
                      </View>

                      {profissionalSelecionado.temp_password ? (
                        <>
                          <View style={styles.senhaBoxAnterior}>
                            <Text style={styles.senhaTextoAnterior} selectable>
                              {mostrarSenhaAnterior ? profissionalSelecionado.temp_password : '••••••••••••'}
                            </Text>

                            <View style={styles.senhaActions}>
                              <TouchableOpacity
                                onPress={() => setMostrarSenhaAnterior(!mostrarSenhaAnterior)}
                                style={styles.iconButton}
                                accessibilityLabel={mostrarSenhaAnterior ? 'Ocultar senha' : 'Ver senha anterior'}
                              >
                                <Ionicons
                                  name={mostrarSenhaAnterior ? 'eye-off' : 'eye'}
                                  size={22}
                                  color={COLORS.textSecondary}
                                />
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleCopiarTexto(profissionalSelecionado.temp_password || '', 'Senha anterior')}
                                style={styles.iconButton}
                                accessibilityLabel="Copiar senha anterior"
                              >
                                <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={styles.senhaHint}>
                            Esta é a senha temporária anteriormente atribuída a esta conta.
                          </Text>
                        </>
                      ) : (
                        <View style={styles.infoBoxMuted}>
                          <Ionicons name="information-circle-outline" size={20} color="#64748B" />
                          <Text style={styles.infoTextMuted}>
                            Nenhuma senha temporária registada anteriormente. O utilizador pode ter definido a sua própria senha ou não possuir registo de senha temporária prévia. Pode redefinir uma nova abaixo.
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* SEÇÃO 2: RESULTADO DE SUCESSO OU FORMULÁRIO DE REDEFINIÇÃO */}
                    {senhaRedefinida ? (
                      <View style={styles.successCard}>
                        <View style={styles.successHeader}>
                          <Ionicons name="checkmark-circle" size={26} color="#059669" />
                          <Text style={styles.successTitle}>Nova Senha Redefinida!</Text>
                        </View>

                        <Text style={styles.successSubtitle}>
                          A nova senha temporária foi configurada no sistema com sucesso.
                        </Text>

                        {/* Box da Nova Senha */}
                        <View style={styles.novaSenhaBox}>
                          <Text style={styles.novaSenhaTexto} selectable>
                            {senhaRedefinida}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleCopiarTexto(senhaRedefinida, 'Nova senha')}
                            style={styles.copiarGrandeButton}
                          >
                            <Ionicons name="copy" size={20} color="#059669" />
                            <Text style={styles.copiarGrandeText}>Copiar</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Status de E-mail */}
                        <View style={styles.emailStatusContainer}>
                          <Ionicons
                            name={emailEnviadoStatus ? 'mail-unread' : 'mail-outline'}
                            size={18}
                            color={emailEnviadoStatus ? '#059669' : '#D97706'}
                          />
                          <Text style={styles.emailStatusText}>
                            {emailEnviadoStatus
                              ? `Disparado e-mail de recuperação para ${profissionalSelecionado.email}.`
                              : `E-mail de notificação preparado para ${profissionalSelecionado.email}.`}
                          </Text>
                        </View>

                        {/* Botões de Envio Direto (Garantia 100%) */}
                        <Text style={styles.acoesEnvioTitulo}>Canais de Envio Direto:</Text>
                        <View style={styles.acoesEnvioContainer}>
                          <TouchableOpacity
                            style={styles.btnAcaoEnvioEmail}
                            onPress={handleAbrirEmailCliente}
                          >
                            <Ionicons name="mail" size={18} color="#FFFFFF" />
                            <Text style={styles.btnAcaoEnvioEmailText}>Enviar no E-mail (Gmail/Outlook)</Text>
                          </TouchableOpacity>

                          {profissionalSelecionado.telefone ? (
                            <TouchableOpacity
                              style={styles.btnAcaoEnvioWhats}
                              onPress={handleEnviarWhatsApp}
                            >
                              <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                              <Text style={styles.btnAcaoEnvioWhatsText}>Enviar por WhatsApp</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.sectionCard}>
                        <View style={styles.sectionHeader}>
                          <Ionicons name="key-outline" size={18} color={COLORS.primary} />
                          <Text style={styles.sectionTitle}>Redefinir Nova Senha</Text>
                        </View>

                        <Text style={styles.inputLabel}>Nova Senha Temporária</Text>
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.novaSenhaInput}
                            placeholder="Mínimo 6 caracteres..."
                            placeholderTextColor={COLORS.textLight}
                            value={novaSenhaInput}
                            onChangeText={setNovaSenhaInput}
                            secureTextEntry={!mostrarNovaSenha}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />

                          {novaSenhaInput ? (
                            <TouchableOpacity
                              onPress={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                              style={styles.iconButtonInput}
                            >
                              <Ionicons
                                name={mostrarNovaSenha ? 'eye-off' : 'eye'}
                                size={20}
                                color={COLORS.textSecondary}
                              />
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            style={styles.btnGerarAuto}
                            onPress={handleGerarSenhaAutomatica}
                            accessibilityLabel="Gerar senha aleatória"
                          >
                            <Ionicons name="flash" size={16} color={COLORS.primary} />
                            <Text style={styles.btnGerarAutoText}>Gerar</Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.fieldNote}>
                          Pode digitar uma senha personalizada ou tocar em "Gerar" para criar uma automaticamente.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>

              {/* Rodapé do Modal */}
              <View style={styles.modalFooter}>
                {senhaRedefinida ? (
                  <TouchableOpacity
                    style={[styles.button, styles.closeButton]}
                    onPress={closeRecoveryModal}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Concluir</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.footerButtonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={closeRecoveryModal}
                    >
                      <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.recoveryButton,
                        processando && styles.buttonDisabled,
                      ]}
                      onPress={handleRedefinirSenha}
                      disabled={processando}
                    >
                      {processando ? (
                        <ActivityIndicator color={COLORS.textInverse} size="small" />
                      ) : (
                        <>
                          <Ionicons name="paper-plane" size={18} color={COLORS.textInverse} />
                          <Text style={styles.buttonText}>Salvar & Enviar Senha</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    backgroundColor: COLORS.surface,
    paddingTop: Platform.select({ ios: 50, android: 20, default: 24 }) as number,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  headerContent: {
    gap: 12,
  },
  headerContentWeb: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitleHeader: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 44,
  },
  searchContainerWeb: {
    flex: 1,
    maxWidth: 380,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.text,
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  webListContent: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  dentistCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  especialidadeText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  passwordStatusRow: {
    marginTop: 6,
  },
  badgeSenhaDisponivel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeSenhaDisponivelText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  badgeSenhaAlterada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  badgeSenhaAlteradaText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#166534',
  },
  badgeSenhaNaoRegistada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeSenhaNaoRegistadaText: {
    fontSize: 11.5,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.select({ web: 24, default: 12 }),
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 540,
    maxHeight: '92%',
    ...SHADOWS.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalBackButton: {
    padding: 4,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    padding: SPACING.lg,
  },
  dentistInfo: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: SPACING.md,
  },
  dentistName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  dentistEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  phoneBadgeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  senhaBoxAnterior: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  senhaTextoAnterior: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    flex: 1,
  },
  senhaActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  senhaHint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 16,
  },
  infoBoxMuted: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTextMuted: {
    flex: 1,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingLeft: 12,
    height: 48,
  },
  novaSenhaInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }),
  },
  iconButtonInput: {
    padding: 8,
  },
  btnGerarAuto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    height: '100%',
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    borderLeftWidth: 1,
    borderLeftColor: '#DBEAFE',
  },
  btnGerarAutoText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fieldNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: SPACING.md,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#15803D',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#166534',
    marginTop: 4,
    marginBottom: 12,
  },
  novaSenhaBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#86EFAC',
    marginBottom: 12,
  },
  novaSenhaTexto: {
    fontSize: 17,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 1.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    flex: 1,
  },
  copiarGrandeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copiarGrandeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  emailStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 14,
  },
  emailStatusText: {
    flex: 1,
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  acoesEnvioTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  acoesEnvioContainer: {
    gap: 8,
  },
  btnAcaoEnvioEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...SHADOWS.sm,
  },
  btnAcaoEnvioEmailText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnAcaoEnvioWhats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...SHADOWS.sm,
  },
  btnAcaoEnvioWhatsText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  recoveryButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  closeButton: {
    width: '100%',
    backgroundColor: '#0F172A',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});

export default AdminPasswordRecoveryScreen;
