/**
 * Painel de Administrador
 * Gerenciar dentistas (criar, listar, atualizar, deletar)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  SectionList,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import {
  listarDentistas,
  criarDentista,
  deletarDentista,
  procurarDentistas,
  atualizarDentista,
  DentistaProfile,
  CriarDentistaResult,
} from '../../services/dentistaService';
import { authService } from '../../services/authService';
import { validators } from '../../utils/validators';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';

const ESPECIALIDADES_DENTISTA = [
  'Ortodontia',
  'Implantologia',
  'Endodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia Bucomaxilofacial',
  'Clinica Geral',
  'Proteses Dentarias',
  'Estetica Dental',
  'Radiologia Odontologica',
];

const PROVINCIAS_ANGOLA = [
  'Bengo',
  'Benguela',
  'Bie',
  'Cabinda',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huila',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Namibe',
  'Uige',
  'Zaire',
];

const getDentistaCRM = (dentista: DentistaProfile): string =>
  dentista.crm || (dentista as any).numero_registro || 'N/A';

const AdminDashboardScreen: React.FC = () => {
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [busca, setBusca] = useState('');
  const [dentistaSelecionado, setDentistaSelecionado] = useState<DentistaProfile | null>(null);
  // expand card to show actions when user taps the "more" icon
  const [expandedDentistaId, setExpandedDentistaId] = useState<string | null>(null);

  // when the menu opens, automatically collapse after a few seconds of inactivity
  useEffect(() => {
    if (!expandedDentistaId) return;
    const timeout = setTimeout(() => setExpandedDentistaId(null), 5000);
    return () => clearTimeout(timeout);
  }, [expandedDentistaId]);

  // Form de novo dentista
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [novaEspecialidade, setNovaEspecialidade] = useState('');
  const [novoCRM, setNovoCRM] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novaProvincia, setNovaProvincia] = useState('');
  const [enviandoForm, setEnviandoForm] = useState(false);

  // Modal de senha temporária gerada
  const [modalSenhaVisivel, setModalSenhaVisivel] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState('');
  const [nomeNovoDentistaParaSenha, setNomeNovoDentistaParaSenha] = useState('');
  const [modalEditarVisivel, setModalEditarVisivel] = useState(false);
  const [dentistaEdicaoId, setDentistaEdicaoId] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editEspecialidade, setEditEspecialidade] = useState('');
  const [editCRM, setEditCRM] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editProvincia, setEditProvincia] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [modalEspecialidadeVisivel, setModalEspecialidadeVisivel] = useState(false);
  const [especialidadeModo, setEspecialidadeModo] = useState<'create' | 'edit'>('create');
  const [modalProvinciaVisivel, setModalProvinciaVisivel] = useState(false);
  const [provinciaModo, setProvinciaModo] = useState<'create' | 'edit'>('create');
  const [formModalToReopen, setFormModalToReopen] = useState<'create' | 'edit' | null>(null);

  const openPickerSafely = (picker: 'especialidade' | 'provincia') => {
    if (modalVisivel) {
      setFormModalToReopen('create');
      setModalVisivel(false);
      setTimeout(() => {
        if (picker === 'especialidade') setModalEspecialidadeVisivel(true);
        else setModalProvinciaVisivel(true);
      }, 120);
      return;
    }

    if (modalEditarVisivel) {
      setFormModalToReopen('edit');
      setModalEditarVisivel(false);
      setTimeout(() => {
        if (picker === 'especialidade') setModalEspecialidadeVisivel(true);
        else setModalProvinciaVisivel(true);
      }, 120);
      return;
    }

    setFormModalToReopen(null);
    if (picker === 'especialidade') setModalEspecialidadeVisivel(true);
    else setModalProvinciaVisivel(true);
  };

  const reopenFormModal = () => {
    if (formModalToReopen === 'create') {
      setTimeout(() => setModalVisivel(true), 120);
    } else if (formModalToReopen === 'edit') {
      setTimeout(() => setModalEditarVisivel(true), 120);
    }
    setFormModalToReopen(null);
  };

  const abrirModalEspecialidade = (modo: 'create' | 'edit') => {
    setEspecialidadeModo(modo);
    openPickerSafely('especialidade');
  };

  const selecionarEspecialidade = (especialidade: string) => {
    if (especialidadeModo === 'create') {
      setNovaEspecialidade(especialidade);
    } else {
      setEditEspecialidade(especialidade);
    }
    setModalEspecialidadeVisivel(false);
    reopenFormModal();
  };

  const abrirModalProvincia = (modo: 'create' | 'edit') => {
    setProvinciaModo(modo);
    openPickerSafely('provincia');
  };

  const selecionarProvincia = (provincia: string) => {
    if (provinciaModo === 'create') {
      setNovaProvincia(provincia);
    } else {
      setEditProvincia(provincia);
    }
    setModalProvinciaVisivel(false);
    reopenFormModal();
  };

  // Carregar dentistas
  const carregarDentistas = async (termo?: string, forceRefresh = false) => {
    setLoading(true);
    try {
      const resultado = termo
        ? await procurarDentistas(termo)
        : await listarDentistas({ forceRefresh });

      if (resultado.success && resultado.data) {
        setDentistas(resultado.data);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar dentistas',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao carregar dentistas',
      });
    } finally {
      setLoading(false);
    }
  };

  // Recarregar na entrada da tela
  useFocusEffect(
    useCallback(() => {
      setExpandedDentistaId(null);
      setModalEspecialidadeVisivel(false);
      setModalProvinciaVisivel(false);
      setFormModalToReopen(null);
      carregarDentistas(undefined, true);
    }, [])
  );

  const handleOpenCreateModal = () => {
    if (enviandoForm || salvandoEdicao) return;
    setExpandedDentistaId(null);
    setModalEspecialidadeVisivel(false);
    setModalProvinciaVisivel(false);
    setFormModalToReopen(null);
    setModalVisivel(true);
  };

  // Busca
  const handleBusca = (texto: string) => {
    setBusca(texto);
    if (texto.trim()) {
      carregarDentistas(texto);
    } else {
      carregarDentistas();
    }
  };

  // Refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarDentistas(busca || undefined, true);
    setRefreshing(false);
  };

  // Criar novo dentista
  const handleCriarDentista = async () => {
    // Validações
    if (!novoEmail.trim()) {
      Toast.show({ type: 'error', text1: 'E-mail obrigatório' });
      return;
    }
    if (!validators.isValidEmail(novoEmail)) {
      Toast.show({ type: 'error', text1: 'E-mail inválido' });
      return;
    }

    if (!novoNome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome obrigatório' });
      return;
    }

    if (!novaSenha.trim()) {
      Toast.show({ type: 'error', text1: 'Senha obrigatória' });
      return;
    }

    if (novaSenha.length < 6) {
      Toast.show({ type: 'error', text1: 'Senha deve ter no mínimo 6 caracteres' });
      return;
    }

    if (!novaEspecialidade.trim()) {
      Toast.show({ type: 'error', text1: 'Especialidade obrigatória' });
      return;
    }

    if (!novoCRM.trim()) {
      Toast.show({ type: 'error', text1: 'CRM obrigatório' });
      return;
    }

    setEnviandoForm(true);

    const emailDentista = novoEmail.trim().toLowerCase();
    const nomeDentista = novoNome.trim();

    const resultado = await authService.adminCreateUser(
      emailDentista,
      novaSenha,
      {
        nome: nomeDentista,
        tipo: 'dentista',
        telefone: novoTelefone || undefined,
        provincia: novaProvincia || undefined,
        emailConfirm: true,
      }
    );

    setEnviandoForm(false);

    if (resultado.success) {
      Toast.show({
        type: 'success',
        text1: 'Dentista criado',
        text2: 'Conta de dentista criada com sucesso',
      });

      if ((resultado.data as any)?.warning) {
        Toast.show({
          type: 'info',
          text1: 'Atencao',
          text2: (resultado.data as any).warning,
        });
      }

      // Mostrar modal com a senha gerada (para caso o admin queira copiar)
      setSenhaGerada(novaSenha);
      setNomeNovoDentistaParaSenha(nomeDentista);
      setModalSenhaVisivel(true);
      try {
        await Clipboard.setStringAsync(novaSenha);
        Toast.show({
          type: 'success',
          text1: 'Senha copiada',
          text2: 'A senha foi copiada automaticamente',
        });
      } catch (e) {
        // silenciosamente ignora falha de cópia
      }

      // Limpar form
      setNovoEmail('');
      setNovoNome('');
      setNovaSenha('');
      setMostrarNovaSenha(false);
      setNovaEspecialidade('');
      setNovoCRM('');
      setNovoTelefone('');
      setNovaProvincia('');
      setModalVisivel(false);

      // Recarregar lista após 1 segundo
      await carregarDentistas(undefined, true);
      if (resultado.data && typeof resultado.data === 'object' && 'id' in resultado.data) {
        setDentistas((prev) => {
          const newData = resultado.data as any;
          if (prev.some((d) => d.id === newData.id)) return prev;
          return [newData as DentistaProfile, ...prev];
        });
      }
    } else {
      const errorMsg = typeof resultado.error === 'string' 
        ? resultado.error 
        : (resultado.error as any)?.message || 'Erro ao criar dentista';
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: errorMsg,
      });
    }
  };

  // Deletar dentista
  const handleDeletarDentista = (dentista: DentistaProfile) => {
    Alert.alert(
      'Confirmar exclusão',
      `Tem certeza que deseja deletar ${dentista.nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const resultado = await deletarDentista(dentista.id);
            setLoading(false);

            if (resultado.success) {
              Toast.show({
                type: 'success',
                text1: 'Deletado',
                text2: 'Dentista removido com sucesso',
              });
              await carregarDentistas(undefined, true);
            } else {
              Toast.show({
                type: 'error',
                text1: 'Erro',
                text2: resultado.error || 'Erro ao deletar dentista',
              });
            }
          },
        },
      ]
    );
  };

  const handleAbrirEdicaoDentista = (dentista: DentistaProfile) => {
    setDentistaEdicaoId(dentista.id);
    setEditNome(dentista.nome || '');
    setEditEspecialidade(dentista.especialidade || '');
    setEditCRM(dentista.crm || (dentista as any).numero_registro || '');
    setEditTelefone(dentista.telefone || '');
    setEditProvincia(dentista.provincia || '');
    setModalEditarVisivel(true);
  };

  const handleSalvarEdicaoDentista = async () => {
    if (!dentistaEdicaoId) return;
    if (!editNome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome obrigatorio' });
      return;
    }
    if (!editEspecialidade.trim()) {
      Toast.show({ type: 'error', text1: 'Especialidade obrigatoria' });
      return;
    }
    if (!editCRM.trim()) {
      Toast.show({ type: 'error', text1: 'CRM obrigatorio' });
      return;
    }

    setSalvandoEdicao(true);
    const resultado = await atualizarDentista(dentistaEdicaoId, {
      nome: editNome.trim(),
      especialidade: editEspecialidade.trim(),
      crm: editCRM.trim(),
      telefone: editTelefone.trim() || undefined,
      provincia: editProvincia.trim() || undefined,
    });
    setSalvandoEdicao(false);

    if (resultado.success) {
      Toast.show({
        type: 'success',
        text1: 'Dentista atualizado',
        text2: 'Dados salvos com sucesso',
      });
      setExpandedDentistaId(null);
      setModalEditarVisivel(false);
      setDentistaSelecionado(null);
      await carregarDentistas(busca || undefined, true);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: resultado.error || 'Nao foi possivel atualizar dentista',
      });
    }
  };

  // Renderizar item dentista
  const renderDentista = ({ item }: { item: DentistaProfile }) => {
    const isExpanded = expandedDentistaId === item.id;

    return (
      <View style={styles.dentistaCard}>
        <View style={styles.dentistaInfo}>
          <View style={styles.dentistaBadge}>
            <Ionicons name="person" size={24} color={COLORS.primary} />
          </View>
          <TouchableOpacity
            style={styles.dentistaTexto}
            activeOpacity={0.7}
            onPress={() => {
              Toast.show({ type: 'info', text1: 'Abrindo detalhes', text2: item.nome || '' });
              setDentistaSelecionado(item);
            }}
          >
            <Text style={styles.dentistaNome}>{item.nome || 'Sem nome'}</Text>
            <Text style={styles.dentistaEspecialidade}>
              {item.especialidade || 'Especialidade não definida'}
            </Text>
            <Text style={styles.dentistaCRM}>CRM: {getDentistaCRM(item)}</Text>
            {item.telefone && (
              <Text style={styles.dentistaTelefone}>📞 {item.telefone}</Text>
            )}
            {item.provincia && (
              <Text style={styles.dentistaProvincia}>📍 {item.provincia}</Text>
            )}
          </TouchableOpacity>
          {/* toggle button for actions */}
          <Pressable
            style={styles.menuToggle}
            onPress={() => {
              if (modalEditarVisivel || salvandoEdicao) return;
              setExpandedDentistaId(isExpanded ? null : item.id);
            }}
            hitSlop={12}
            disabled={modalEditarVisivel || salvandoEdicao}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={24}
              color={COLORS.textSecondary}
            />
          </Pressable>
        </View>

        {isExpanded && (
          <View style={styles.dentistaAcoes}>
            <TouchableOpacity
              style={styles.botaoAcao}
              onPress={() => {
                Toast.show({ type: 'info', text1: 'Visualizar', text2: item.nome || '' });
                setDentistaSelecionado(item);
              }}
            >
              <Ionicons name="eye" size={20} color={COLORS.primary} />
              <Text style={styles.botaoAcaoTexto}>Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botaoAcao, styles.botaoEditar]}
              onPress={() => {
                Toast.show({ type: 'info', text1: 'Editar', text2: item.nome || '' });
                handleAbrirEdicaoDentista(item);
              }}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.textInverse} />
              <Text style={[styles.botaoAcaoTexto, { color: COLORS.textInverse }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.botaoAcao, styles.botaoDelete]}
              onPress={() => {
                Toast.show({ type: 'info', text1: 'Apagar', text2: item.nome || '' });
                handleDeletarDentista(item);
              }}
            >
              <Ionicons name="trash" size={20} color={COLORS.error} />
              <Text style={[styles.botaoAcaoTexto, { color: COLORS.error }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={Platform.OS === 'web' && styles.headerContent}>
          <Text style={styles.headerTitle}>Gerenciar Dentistas</Text>
          <Pressable
            style={styles.botaoCriar}
            onPress={handleOpenCreateModal}
            hitSlop={12}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
          >
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </Pressable>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{dentistas.length}</Text>
          <Text style={styles.statLabel}>Total de Dentistas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Total de Pacientes</Text>
        </View>
      </View>

      <View style={[
        styles.buscaContainer,
        Platform.OS === 'web' && { maxWidth: 900, alignSelf: 'center', width: '90%' }
      ]}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por nome ou especialidade..."
          value={busca}
          onChangeText={handleBusca}
          placeholderTextColor={COLORS.textSecondary}
        />
        {busca ? (
          <TouchableOpacity onPress={() => handleBusca('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Lista de dentistas */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando dentistas...</Text>
        </View>
      ) : dentistas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Nenhum dentista encontrado</Text>
          <Text style={styles.emptySubtext}>
            {busca ? 'Tente uma busca diferente' : 'Clique em + para adicionar um dentista'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={(() => {
            const groups: Record<string, DentistaProfile[]> = {};
            dentistas.forEach((d) => {
              const spec = d.especialidade || 'Sem especialidade';
              if (!groups[spec]) groups[spec] = [];
              groups[spec].push(d);
            });
            return Object.entries(groups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([title, data]) => ({ title, data }));
          })()}
          renderItem={renderDentista}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeader}>
              <Ionicons name="medical" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{data.length}</Text>
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listaContainer,
            Platform.OS === 'web' && styles.webListaContainer
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onScrollBeginDrag={() => setExpandedDentistaId(null)}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Modal - Criar dentista */}
      <Modal
        visible={modalVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingModal}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Novo Dentista</Text>
              <TouchableOpacity onPress={() => setModalVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>E-mail *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="email@exemplo.com"
                  value={novoEmail}
                  onChangeText={setNovoEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!enviandoForm}
                />
              </View>

              {/* Nome */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Nome do dentista"
                  value={novoNome}
                  onChangeText={setNovoNome}
                  editable={!enviandoForm}
                />
              </View>

              {/* Senha */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Senha *</Text>
                <View style={styles.passwordInput}>
                  <TextInput
                    style={styles.passwordInputField}
                    placeholder="Digite a senha temporaria"
                    value={novaSenha}
                    onChangeText={setNovaSenha}
                    secureTextEntry={!mostrarNovaSenha}
                    editable={!enviandoForm}
                  />
                  <TouchableOpacity
                    onPress={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                    disabled={enviandoForm}
                  >
                    <Ionicons
                      name={mostrarNovaSenha ? 'eye' : 'eye-off'}
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Especialidade */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Especialidade *</Text>
                <TouchableOpacity
                  style={styles.formInput}
                  onPress={() => abrirModalEspecialidade('create')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: novaEspecialidade ? COLORS.text : COLORS.textSecondary }}>
                    {novaEspecialidade || 'Selecionar especialidade'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CRM */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CRM *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Ex: 12345/AO"
                  value={novoCRM}
                  onChangeText={setNovoCRM}
                  editable={!enviandoForm}
                />
              </View>

              {/* Telefone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefone</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="(+244) 923456789"
                  value={novoTelefone}
                  onChangeText={setNovoTelefone}
                  keyboardType="phone-pad"
                  editable={!enviandoForm}
                />
              </View>

              {/* Província */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Província</Text>
                <TouchableOpacity
                  style={styles.formInput}
                  onPress={() => abrirModalProvincia('create')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: novaProvincia ? COLORS.text : COLORS.textSecondary }}>
                    {novaProvincia || 'Selecionar provincia'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formNote}>* Campos obrigatórios</Text>
            </ScrollView>

            {/* Botões */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoCancelar]}
                onPress={() => setModalVisivel(false)}
                disabled={enviandoForm}
              >
                <Text style={styles.botaoModalTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoConfirmar]}
                onPress={handleCriarDentista}
                disabled={enviandoForm}
              >
                {enviandoForm ? (
                  <ActivityIndicator color={COLORS.textInverse} />
                ) : (
                  <Text style={[styles.botaoModalTexto, styles.botaoConfirmarTexto]}>
                    Criar Dentista
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal - Detalhes do dentista */}
      <Modal
        visible={dentistaSelecionado !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDentistaSelecionado(null)}
      >
        {dentistaSelecionado && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalhes do Dentista</Text>
                <TouchableOpacity onPress={() => setDentistaSelecionado(null)}>
                  <Ionicons name="close" size={28} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.detalhesContainer} keyboardShouldPersistTaps="handled">
                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Nome:</Text>
                  <Text style={styles.detalheValor}>{dentistaSelecionado.nome || 'N/A'}</Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>E-mail:</Text>
                  <Text style={styles.detalheValor}>{dentistaSelecionado.email || 'N/A'}</Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Especialidade:</Text>
                  <Text style={styles.detalheValor}>
                    {dentistaSelecionado.especialidade || 'Não definida'}
                  </Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>CRM:</Text>
                  <Text style={styles.detalheValor}>{getDentistaCRM(dentistaSelecionado)}</Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Telefone:</Text>
                  <Text style={styles.detalheValor}>
                    {dentistaSelecionado.telefone || 'Não informado'}
                  </Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Província:</Text>
                  <Text style={styles.detalheValor}>
                    {dentistaSelecionado.provincia || 'Não informada'}
                  </Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Criado em:</Text>
                  <Text style={styles.detalheValor}>
                    {dentistaSelecionado.created_at
                      ? new Date(dentistaSelecionado.created_at).toLocaleDateString('pt-AO')
                      : 'N/A'}
                  </Text>
                </View>

                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Atualizado em:</Text>
                  <Text style={styles.detalheValor}>
                    {dentistaSelecionado.updated_at
                      ? new Date(dentistaSelecionado.updated_at).toLocaleDateString('pt-AO')
                      : dentistaSelecionado.created_at
                      ? new Date(dentistaSelecionado.created_at).toLocaleDateString('pt-AO')
                      : 'N/A'}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.botaoModal, styles.botaoCancelar]}
                  onPress={() => setDentistaSelecionado(null)}
                >
                  <Text style={styles.botaoModalTexto}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Modal - Editar dentista */}
      <Modal
        visible={modalEditarVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalEditarVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Dentista</Text>
              <TouchableOpacity onPress={() => setModalEditarVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editNome}
                  onChangeText={setEditNome}
                  editable={!salvandoEdicao}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Especialidade *</Text>
                <TouchableOpacity
                  style={styles.formInput}
                  onPress={() => abrirModalEspecialidade('edit')}
                  disabled={salvandoEdicao}
                >
                  <Text style={{ color: editEspecialidade ? COLORS.text : COLORS.textSecondary }}>
                    {editEspecialidade || 'Selecionar especialidade'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>CRM *</Text>
                <TextInput
                  style={styles.formInput}
                  value={editCRM}
                  onChangeText={setEditCRM}
                  editable={!salvandoEdicao}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefone</Text>
                <TextInput
                  style={styles.formInput}
                  value={editTelefone}
                  onChangeText={setEditTelefone}
                  keyboardType="phone-pad"
                  editable={!salvandoEdicao}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Provincia</Text>
                <TouchableOpacity
                  style={styles.formInput}
                  onPress={() => abrirModalProvincia('edit')}
                  disabled={salvandoEdicao}
                >
                  <Text style={{ color: editProvincia ? COLORS.text : COLORS.textSecondary }}>
                    {editProvincia || 'Selecionar provincia'}
                  </Text>
                </TouchableOpacity>
              </View>

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoCancelar]}
                onPress={() => setModalEditarVisivel(false)}
                disabled={salvandoEdicao}
              >
                <Text style={styles.botaoModalTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoConfirmar]}
                onPress={handleSalvarEdicaoDentista}
                disabled={salvandoEdicao}
              >
                {salvandoEdicao ? (
                  <ActivityIndicator color={COLORS.textInverse} />
                ) : (
                  <Text style={[styles.botaoModalTexto, styles.botaoConfirmarTexto]}>
                    Salvar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal - Senha Gerada */}
      <Modal
        visible={modalSenhaVisivel}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalSenhaVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✅ Dentista Criado!</Text>
              <TouchableOpacity onPress={() => setModalSenhaVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text 
                style={{
                  fontSize: TYPOGRAPHY.sizes.body,
                  color: COLORS.text,
                  marginBottom: SPACING.lg,
                  lineHeight: 24,
                }}
              >
                O dentista <Text style={{ fontWeight: 'bold' }}>{nomeNovoDentistaParaSenha}</Text> foi criado com sucesso!
              </Text>

              <View style={{ backgroundColor: '#FFF3CD', padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.lg }}>
                <Text style={{ color: '#856404', fontWeight: '600', marginBottom: SPACING.sm }}>
                  ⚠️ Senha Temporária:
                </Text>
                <View 
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: SPACING.md,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#FFE69C',
                    marginBottom: SPACING.md,
                  }}
                >
                  <Text 
                    style={{
                      fontSize: TYPOGRAPHY.sizes.h3,
                      fontWeight: 'bold',
                      color: COLORS.primary,
                      letterSpacing: 1,
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}
                  >
                    {senhaGerada}
                  </Text>
                </View>
                <TouchableOpacity
                onPress={async () => {
                try {
                await Clipboard.setStringAsync(senhaGerada);
                Toast.show({
                type: 'success',
                text1: 'Copiado!',
                text2: 'Senha copiada para área de transferência',
                });
                } catch (e) {
                Toast.show({ type: 'error', text1: 'Falha ao copiar senha' });
                }
                }}
                style={{ backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 6 }}
                >
                  <Text style={{ color: COLORS.textInverse, textAlign: 'center', fontWeight: '600' }}>
                    📋 Copiar Senha
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: '#E1F5FE', padding: SPACING.md, borderRadius: 8 }}>
                <Text style={{ color: '#0277BD', fontWeight: '600', marginBottom: SPACING.sm }}>
                  ℹ️ Informações Importantes:
                </Text>
                <Text style={{ color: '#01579B', fontSize: TYPOGRAPHY.sizes.small, lineHeight: 18, marginBottom: SPACING.sm }}>
                  • Compartilhe esta senha com o dentista de forma segura
                </Text>
                <Text style={{ color: '#01579B', fontSize: TYPOGRAPHY.sizes.small, lineHeight: 18, marginBottom: SPACING.sm }}>
                  • O dentista será obrigado a alterar na primeira login
                </Text>
                <Text style={{ color: '#01579B', fontSize: TYPOGRAPHY.sizes.small, lineHeight: 18 }}>
                  • Nunca compartilhe senhas por meios inseguros
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoConfirmar]}
                onPress={() => setModalSenhaVisivel(false)}
              >
                <Text style={[styles.botaoModalTexto, styles.botaoConfirmarTexto]}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalEspecialidadeVisivel}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setModalEspecialidadeVisivel(false);
          reopenFormModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Especialidade</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalEspecialidadeVisivel(false);
                  reopenFormModal();
                }}
              >
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {ESPECIALIDADES_DENTISTA.map((especialidade) => {
                const selecionada =
                  especialidadeModo === 'create'
                    ? novaEspecialidade === especialidade
                    : editEspecialidade === especialidade;
                return (
                  <TouchableOpacity
                    key={especialidade}
                    style={[
                      styles.opcaoEspecialidade,
                      selecionada && {
                        borderLeftColor: COLORS.success,
                        backgroundColor: COLORS.primaryLight,
                      },
                    ]}
                    onPress={() => selecionarEspecialidade(especialidade)}
                  >
                    <Text style={styles.opcaoEspecialidadeTexto}>{especialidade}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal - Provincia */}
      <Modal
        visible={modalProvinciaVisivel}
        animationType="slide"
        transparent={true}
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setModalProvinciaVisivel(false);
          reopenFormModal();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Província</Text>
              <TouchableOpacity
                onPress={() => {
                  setModalProvinciaVisivel(false);
                  reopenFormModal();
                }}
              >
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {PROVINCIAS_ANGOLA.map((provincia) => {
                const selecionada =
                  provinciaModo === 'create'
                    ? novaProvincia === provincia
                    : editProvincia === provincia;
                return (
                  <TouchableOpacity
                    key={provincia}
                    style={[
                      styles.opcaoEspecialidade,
                      selecionada && {
                        borderLeftColor: COLORS.success,
                        backgroundColor: COLORS.primaryLight,
                      },
                    ]}
                    onPress={() => selecionarProvincia(provincia)}
                  >
                    <Text style={styles.opcaoEspecialidadeTexto}>{provincia}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerContent: {
    width: '100%',
    maxWidth: 900,
    flexDirection: 'row',
    alignSelf: 'center',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botaoCriar: {
    padding: SPACING.sm,
  },
  acoesRapidasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  acaoRapida: {
    width: '48.5%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: SPACING.sm,
  },
  acaoRapidaAtiva: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  acaoRapidaTexto: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buscaInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
  },
  listaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  webListaContainer: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  dentistaCard: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  dentistaInfo: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  dentistaBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  dentistaTexto: {
    flex: 1,
  },
  menuToggle: {
    minWidth: 44,
    minHeight: 44,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dentistaNome: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  dentistaEspecialidade: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.primary,
    marginBottom: 4,
    fontWeight: '600',
  },
  dentistaCRM: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  dentistaTelefone: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  dentistaProvincia: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
  },
  dentistaAcoes: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
    // use margins on individual buttons since gap is not universally supported
  },
  botaoAcao: {
    minWidth: 56,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginLeft: SPACING.md, // spacing between action buttons
  },
  botaoAcaoTexto: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  botaoDelete: {
    backgroundColor: COLORS.errorLight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.h3,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  statCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 120,
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  keyboardAvoidingModal: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 600 : '100%',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignSelf: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    paddingTop: SPACING.lg,
    maxHeight: Platform.OS === 'web' ? '80%' : '90%',
    paddingBottom: SPACING.lg,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalForm: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    flexShrink: 1,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
    backgroundColor: COLORS.backgroundSecondary,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInputField: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  formReadOnlyValue: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
  },
  formNote: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  botaoModal: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  botaoCancelar: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  botaoConfirmar: {
    backgroundColor: COLORS.primary,
  },
  botaoEditar: {
    backgroundColor: COLORS.info,
  },
  botaoModalTexto: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  botaoConfirmarTexto: {
    color: COLORS.textInverse,
  },
  detalhesContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  detalheItem: {
    marginBottom: SPACING.lg,
  },
  detalheLabel: {
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  detalheValor: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
    fontWeight: '500',
  },
  opcaoEspecialidade: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  opcaoEspecialidadeTexto: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: 8,
    marginHorizontal: SPACING.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  sectionBadgeText: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.sizes.small,
    fontWeight: '700',
  },
});

export default AdminDashboardScreen;

