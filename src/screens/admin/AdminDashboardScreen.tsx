/**
 * Painel de Administrador
 * Gerenciar dentistas (criar, listar, atualizar, deletar)
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
  FlatList,
  Alert,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  listarDentistas,
  criarDentista,
  deletarDentista,
  procurarDentistas,
  atualizarDentista,
  DentistaProfile,
} from '../../services/dentistaService';
import {
  sendWelcomeEmailToDentista,
  sendPasswordRecoveryEmail,
} from '../../services/emailService';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { gerarSenhaTemporaria } from '../../utils/senhaUtils';
import type { AdminTabParamList } from '../../navigation/AdminNavigator';

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
  const navigation = useNavigation<BottomTabNavigationProp<AdminTabParamList>>();
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisivel, setModalVisivel] = useState(false);
  const [busca, setBusca] = useState('');
  const [dentistaSelecionado, setDentistaSelecionado] = useState<DentistaProfile | null>(null);

  // Form de novo dentista
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
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

  // Gerar nova senha aleatória
  const handleGerarNovaSenha = () => {
    const novaSenhaGerada = gerarSenhaTemporaria();
    setNovaSenha(novaSenhaGerada);
    Toast.show({
      type: 'success',
      text1: 'Senha gerada',
      text2: 'Uma nova senha temporária foi gerada',
    });
  };

  const abrirModalEspecialidade = (modo: 'create' | 'edit') => {
    setEspecialidadeModo(modo);
    setModalEspecialidadeVisivel(true);
  };

  const selecionarEspecialidade = (especialidade: string) => {
    if (especialidadeModo === 'create') {
      setNovaEspecialidade(especialidade);
    } else {
      setEditEspecialidade(especialidade);
    }
    setModalEspecialidadeVisivel(false);
  };

  const abrirModalProvincia = (modo: 'create' | 'edit') => {
    setProvinciaModo(modo);
    setModalProvinciaVisivel(true);
  };

  const selecionarProvincia = (provincia: string) => {
    if (provinciaModo === 'create') {
      setNovaProvincia(provincia);
    } else {
      setEditProvincia(provincia);
    }
    setModalProvinciaVisivel(false);
  };

  // Carregar dentistas
  const carregarDentistas = async (termo?: string) => {
    setLoading(true);
    try {
      const resultado = termo
        ? await procurarDentistas(termo)
        : await listarDentistas();

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
      carregarDentistas();
    }, [])
  );

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
    await carregarDentistas(busca || undefined);
    setRefreshing(false);
  };

  // Criar novo dentista
  const handleCriarDentista = async () => {
    // Validações
    if (!novoEmail.trim()) {
      Toast.show({ type: 'error', text1: 'E-mail obrigatório' });
      return;
    }

    if (!novoNome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome obrigatório' });
      return;
    }

    // Gerar senha automática se não preenchida
    let senhaParaUsar = novaSenha;
    if (!senhaParaUsar.trim()) {
      senhaParaUsar = gerarSenhaTemporaria();
    }

    if (senhaParaUsar.length < 6) {
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

    const resultado = await criarDentista(
      emailDentista,
      senhaParaUsar,
      nomeDentista,
      novaEspecialidade,
      novoCRM,
      novoTelefone || undefined,
      novaProvincia || undefined
    );

    setEnviandoForm(false);

    if (resultado.success) {
      let emailResult = await sendWelcomeEmailToDentista(
        emailDentista,
        nomeDentista,
        senhaParaUsar
      );

      if (!emailResult.success) {
        emailResult = await sendPasswordRecoveryEmail(
          emailDentista,
          nomeDentista,
          senhaParaUsar
        );
      }

      if (emailResult.success) {
        Toast.show({
          type: 'success',
          text1: 'Email enviado',
          text2: 'Senha temporaria enviada para o email do dentista',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Dentista criado',
          text2: 'Nao foi possivel enviar email automaticamente',
        });
      }

      // Mostrar modal com a senha gerada
      setSenhaGerada(senhaParaUsar);
      setNomeNovoDentistaParaSenha(nomeDentista);
      setModalSenhaVisivel(true);
      if (Clipboard && Clipboard.setString) {
        Clipboard.setString(senhaParaUsar);
        Toast.show({
          type: 'success',
          text1: 'Senha copiada',
          text2: 'A senha temporaria foi copiada automaticamente',
        });
      }

      // Limpar form
      setNovoEmail('');
      setNovoNome('');
      setNovaSenha('');
      setNovaEspecialidade('');
      setNovoCRM('');
      setNovoTelefone('');
      setNovaProvincia('');
      setModalVisivel(false);

      // Recarregar lista após 1 segundo
      await carregarDentistas();
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: resultado.error || 'Erro ao criar dentista',
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
              await carregarDentistas();
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
    setEditCRM(dentista.crm || '');
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
      setModalEditarVisivel(false);
      setDentistaSelecionado(null);
      await carregarDentistas(busca || undefined);
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: resultado.error || 'Nao foi possivel atualizar dentista',
      });
    }
  };

  // Renderizar item dentista
  const renderDentista = ({ item }: { item: DentistaProfile }) => (
    <View style={styles.dentistaCard}>
      <View style={styles.dentistaInfo}>
        <View style={styles.dentistaBadge}>
          <Ionicons name="person" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.dentistaTexto}>
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
        </View>
      </View>

      <View style={styles.dentistaAcoes}>
        <TouchableOpacity
          style={styles.botaoAcao}
          onPress={() => setDentistaSelecionado(item)}
        >
          <Ionicons name="eye" size={20} color={COLORS.primary} />
          <Text style={styles.botaoAcaoTexto}>Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botaoAcao, styles.botaoEditar]}
          onPress={() => handleAbrirEdicaoDentista(item)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.textInverse} />
          <Text style={[styles.botaoAcaoTexto, { color: COLORS.textInverse }]}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botaoAcao, styles.botaoDelete]}
          onPress={() => handleDeletarDentista(item)}
        >
          <Ionicons name="trash" size={20} color={COLORS.error} />
          <Text style={[styles.botaoAcaoTexto, { color: COLORS.error }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gerenciar Dentistas</Text>
        <TouchableOpacity
          style={styles.botaoCriar}
          onPress={() => setModalVisivel(true)}
        >
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.buscaContainer}>
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
        <FlatList
          data={dentistas}
          renderItem={renderDentista}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listaContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Criar Novo Dentista</Text>
              <TouchableOpacity onPress={() => setModalVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.formLabel}>Senha *</Text>
                  <TouchableOpacity onPress={handleGerarNovaSenha} disabled={enviandoForm}>
                    <Text style={{ color: COLORS.primary, fontWeight: '600' }}>
                      🔀 Gerar Aleatória
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.formInput}
                  placeholder="Deixe vazio para gerar automaticamente"
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  secureTextEntry
                  editable={!enviandoForm}
                />
              </View>

              {/* Especialidade */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Especialidade *</Text>
                <TouchableOpacity
                  style={styles.formInput}
                  onPress={() => abrirModalEspecialidade('create')}
                  disabled={enviandoForm}
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
                  disabled={enviandoForm}
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

              <ScrollView style={styles.detalhesContainer}>
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

            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ID</Text>
                <View style={styles.formInput}>
                  <Text style={styles.formReadOnlyValue}>{dentistaEdicaoId || '-'}</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>E-mail</Text>
                <View style={styles.formInput}>
                  <Text style={styles.formReadOnlyValue}>
                    {dentistaSelecionado?.email || 'Nao informado'}
                  </Text>
                </View>
              </View>

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

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Criado em</Text>
                <View style={styles.formInput}>
                  <Text style={styles.formReadOnlyValue}>
                    {dentistaSelecionado?.created_at
                      ? new Date(dentistaSelecionado.created_at).toLocaleDateString('pt-AO')
                      : 'N/A'}
                  </Text>
                </View>
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
                  onPress={() => {
                    if (Clipboard && Clipboard.setString) {
                      Clipboard.setString(senhaGerada);
                      Toast.show({
                        type: 'success',
                        text1: 'Copiado!',
                        text2: 'Senha copiada para área de transferência',
                      });
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
        onRequestClose={() => setModalEspecialidadeVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Especialidade</Text>
              <TouchableOpacity onPress={() => setModalEspecialidadeVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
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
  dentistaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    gap: SPACING.md,
  },
  botaoAcao: {
    minWidth: 56,
    height: 50,
    borderRadius: 8,
    backgroundColor: COLORS.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
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
    marginBottom: SPACING.sm,
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.lg,
    maxHeight: '90%',
    paddingBottom: SPACING.xl,
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
});

export default AdminDashboardScreen;

