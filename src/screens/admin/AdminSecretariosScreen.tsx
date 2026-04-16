/**
 * Painel de Administrador - Gerenciar Secretarios/Recepcionistas
 * Criar, listar, editar e eliminar contas de secretario.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { authService } from '../../services/authService';
import { validators } from '../../utils/validators';
import { calculateAgeFromBirthDate, formatBirthDateInput } from '../../utils/helpers';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';

interface SecretarioProfile {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
  genero?: string;
  data_nascimento?: string;
  idade?: number;
  created_at?: string;
}

const PROVINCIAS_ANGOLA = [
  'Bengo', 'Benguela', 'Bie', 'Cabinda', 'Cuando Cubango', 'Cuanza Norte', 'Cuanza Sul',
  'Cunene', 'Huambo', 'Huila', 'Luanda', 'Lunda Norte', 'Lunda Sul', 'Malanje',
  'Moxico', 'Namibe', 'Uige', 'Zaire',
];

const GENEROS: Array<'Masculino' | 'Feminino' | 'Outro'> = ['Masculino', 'Feminino', 'Outro'];

const buildObservacoesGerais = (dataNascimento: string, genero: string) => {
  const idade = calculateAgeFromBirthDate(dataNascimento);
  return `[DN]: ${dataNascimento || '-'} [G]: ${genero || '-'} [IDADE]: ${idade ?? '-'}`;
};

const isBirthDateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && calculateAgeFromBirthDate(value) !== null;

const AdminSecretariosScreen: React.FC = () => {
  const [secretarios, setSecretarios] = useState<SecretarioProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modalCriar, setModalCriar] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoGenero, setNovoGenero] = useState('');
  const [novaDataNascimento, setNovaDataNascimento] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [criando, setCriando] = useState(false);

  const [modalSenha, setModalSenha] = useState(false);
  const [senhaGerada, setSenhaGerada] = useState('');
  const [nomeParaSenha, setNomeParaSenha] = useState('');

  const [modalEditar, setModalEditar] = useState(false);
  const [editId, setEditId] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editGenero, setEditGenero] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [modalProvincia, setModalProvincia] = useState(false);
  const [provinciaTarget, setProvinciaTarget] = useState<'create' | 'edit'>('create');
  const [novaProvincia, setNovaProvincia] = useState('');
  const [editProvincia, setEditProvincia] = useState('');

  useEffect(() => {
    if (!expandedId) return;
    const timer = setTimeout(() => setExpandedId(null), 5000);
    return () => clearTimeout(timer);
  }, [expandedId]);

  const carregar = async () => {
    setLoading(true);
    try {
      const result = await authService.adminListSecretarios();
      if (!result.success) throw new Error(result.error?.message || 'Erro ao carregar');
      setSecretarios(result.data || []);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro ao carregar secretarios', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setExpandedId(null);
      carregar();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregar();
    setRefreshing(false);
  };

  const limparFormulario = () => {
    setNovoEmail('');
    setNovoNome('');
    setNovaSenha('');
    setNovoTelefone('');
    setNovoGenero('');
    setNovaDataNascimento('');
    setNovaProvincia('');
    setMostrarSenha(false);
  };

  const handleCriar = async () => {
    if (!novoEmail.trim()) { Toast.show({ type: 'error', text1: 'E-mail obrigatorio' }); return; }
    if (!validators.isValidEmail(novoEmail)) { Toast.show({ type: 'error', text1: 'E-mail invalido' }); return; }
    if (!novoNome.trim()) { Toast.show({ type: 'error', text1: 'Nome obrigatorio' }); return; }
    if (!novaSenha.trim()) { Toast.show({ type: 'error', text1: 'Senha obrigatoria' }); return; }
    if (novaSenha.length < 6) { Toast.show({ type: 'error', text1: 'Senha minima de 6 caracteres' }); return; }
    if (!novaDataNascimento.trim()) { Toast.show({ type: 'error', text1: 'Data de nascimento obrigatoria' }); return; }
    if (!isBirthDateValid(novaDataNascimento.trim())) { Toast.show({ type: 'error', text1: 'Data de nascimento invalida' }); return; }
    if (!novoGenero) { Toast.show({ type: 'error', text1: 'Sexo / genero obrigatorio' }); return; }

    setCriando(true);
    const resultado = await authService.adminCreateUser(novoEmail.trim().toLowerCase(), novaSenha, {
      nome: novoNome.trim(),
      tipo: 'secretario',
      role: 'secretario',
      telefone: novoTelefone.trim() || undefined,
      genero: novoGenero as 'Masculino' | 'Feminino' | 'Outro',
      data_nascimento: novaDataNascimento.trim(),
      provincia: novaProvincia || undefined,
      emailConfirm: true,
    });
    setCriando(false);

    if (resultado.success) {
      setSenhaGerada(novaSenha);
      setNomeParaSenha(novoNome.trim());
      setModalCriar(false);
      setModalSenha(true);
      try { await Clipboard.setStringAsync(novaSenha); } catch {}
      Toast.show({ type: 'success', text1: 'Secretario criado!', text2: 'Conta criada com sucesso' });
      limparFormulario();
      await carregar();
    } else {
      const msg = typeof resultado.error === 'string' ? resultado.error : resultado.error?.message || 'Erro ao criar';
      Toast.show({ type: 'error', text1: 'Erro', text2: msg });
    }
  };

  const abrirEditar = (secretario: SecretarioProfile) => {
    setEditId(secretario.id);
    setEditNome(secretario.nome || '');
    setEditTelefone(secretario.telefone || '');
    setEditGenero(secretario.genero || '');
    setEditDataNascimento(secretario.data_nascimento || '');
    setEditProvincia('');
    setModalEditar(true);
  };

  const handleSalvarEdicao = async () => {
    if (!editNome.trim()) { Toast.show({ type: 'error', text1: 'Nome obrigatorio' }); return; }
    if (!editDataNascimento.trim()) { Toast.show({ type: 'error', text1: 'Data de nascimento obrigatoria' }); return; }
    if (!isBirthDateValid(editDataNascimento.trim())) { Toast.show({ type: 'error', text1: 'Data de nascimento invalida' }); return; }
    if (!editGenero.trim()) { Toast.show({ type: 'error', text1: 'Sexo / genero obrigatorio' }); return; }
    setSalvando(true);
    const { supabase } = await import('../../config/supabase');
    const payload: Record<string, any> = {
      nome: editNome.trim(),
      data_nascimento: editDataNascimento.trim(),
      genero: editGenero.trim(),
      idade: calculateAgeFromBirthDate(editDataNascimento.trim()),
      observacoes_gerais: buildObservacoesGerais(editDataNascimento.trim(), editGenero.trim()),
    };
    if (editTelefone.trim()) payload.telefone = editTelefone.trim();
    if (editProvincia) payload.provincia = editProvincia;

    const { error } = await supabase.from('profiles').update(payload).eq('id', editId);
    setSalvando(false);

    if (error) {
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: error.message });
    } else {
      Toast.show({ type: 'success', text1: 'Dados atualizados!' });
      setModalEditar(false);
      setExpandedId(null);
      await carregar();
    }
  };

  const handleExcluir = (secretario: SecretarioProfile) => {
    const confirmar = async () => {
      setLoading(true);
      const result = await authService.adminDeleteUser(secretario.id);
      setLoading(false);

      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Erro ao excluir', text2: result.error?.message });
      } else {
        Toast.show({ type: 'success', text1: 'Secretario removido' });
        await carregar();
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir ${secretario.nome || 'secretario'}? Esta acao e irreversivel.`)) confirmar();
    } else {
      Alert.alert('Confirmar exclusao', `Deseja excluir ${secretario.nome || 'secretario'}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: confirmar },
      ]);
    }
  };

  const listaFiltrada = busca.trim()
    ? secretarios.filter((item) =>
        (item.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
        (item.email || '').toLowerCase().includes(busca.toLowerCase())
      )
    : secretarios;

  const renderItem = ({ item }: { item: SecretarioProfile }) => {
    const isExpanded = expandedId === item.id;
    const idade = item.idade ?? calculateAgeFromBirthDate(item.data_nascimento);
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardAvatar}>
            <Ionicons name="person" size={24} color="#7C3AED" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardNome}>{item.nome || 'Sem nome'}</Text>
            <Text style={styles.cardEmail}>{item.email || '-'}</Text>
            {item.telefone ? <Text style={styles.cardMeta}>Telefone: {item.telefone}</Text> : null}
            {item.data_nascimento ? (
              <Text style={styles.cardMeta}>
                Nasc.: {item.data_nascimento}{idade !== null && idade !== undefined ? ` • ${idade} anos` : ''}
              </Text>
            ) : null}
            {item.genero ? <Text style={styles.cardMeta}>Sexo/Gênero: {item.genero}</Text> : null}
          </View>
          <Pressable
            style={styles.menuToggle}
            onPress={() => setExpandedId(isExpanded ? null : item.id)}
            hitSlop={12}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true }}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textSecondary} />
          </Pressable>
        </View>

        {isExpanded && (
          <View style={styles.acoes}>
            <TouchableOpacity style={styles.acaoBtn} onPress={() => abrirEditar(item)}>
              <Ionicons name="create-outline" size={18} color={COLORS.textInverse} />
              <Text style={styles.acaoBtnText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acaoBtn, styles.acaoBtnDelete]} onPress={() => handleExcluir(item)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              <Text style={[styles.acaoBtnText, { color: COLORS.error }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={Platform.OS === 'web' ? styles.headerContent : undefined}>
          <Text style={styles.headerTitle}>Gerenciar Secretarios</Text>
          <Pressable style={styles.botaoAdicionar} onPress={() => setModalCriar(true)} hitSlop={12}>
            <Ionicons name="add-circle" size={28} color="#7C3AED" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.buscaContainer, Platform.OS === 'web' && { maxWidth: 900, alignSelf: 'center', width: '90%' }]}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.buscaInput}
          placeholder="Buscar por nome ou email..."
          value={busca}
          onChangeText={setBusca}
          placeholderTextColor={COLORS.textSecondary}
        />
        {busca ? (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Carregando secretarios...</Text>
        </View>
      ) : (
        <FlatList
          data={listaFiltrada}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#7C3AED']} />}
          contentContainerStyle={[styles.lista, Platform.OS === 'web' && styles.webLista]}
          onScrollBeginDrag={() => setExpandedId(null)}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Ionicons name="people-outline" size={18} color="#7C3AED" />
              <Text style={styles.listHeaderText}>{listaFiltrada.length} secretario(s) cadastrado(s)</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nenhum secretario encontrado</Text>
              <Text style={styles.emptySubtext}>
                {busca ? 'Tente uma busca diferente' : 'Clique em + para adicionar um secretario'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={modalCriar} animationType="slide" transparent onRequestClose={() => setModalCriar(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Criar Novo Secretario</Text>
                <TouchableOpacity onPress={() => setModalCriar(false)}>
                  <Ionicons name="close" size={28} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nome Completo *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Nome do secretario"
                    value={novoNome}
                    onChangeText={setNovoNome}
                    editable={!criando}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>E-mail *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="email@exemplo.com"
                    value={novoEmail}
                    onChangeText={setNovoEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!criando}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Senha Temporaria *</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Minimo 6 caracteres"
                      value={novaSenha}
                      onChangeText={setNovaSenha}
                      secureTextEntry={!mostrarSenha}
                      editable={!criando}
                      placeholderTextColor={COLORS.textSecondary}
                    />
                    <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} disabled={criando}>
                      <Ionicons name={mostrarSenha ? 'eye' : 'eye-off'} size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Telefone</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="(+244) 923456789"
                    value={novoTelefone}
                    onChangeText={setNovoTelefone}
                    keyboardType="phone-pad"
                    editable={!criando}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Sexo / Genero *</Text>
                  <View style={styles.generoRow}>
                    {GENEROS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.generoBtn, novoGenero === item && styles.generoBtnAtivo]}
                        onPress={() => setNovoGenero(item)}
                        disabled={criando}
                      >
                        <Text style={[styles.generoBtnText, novoGenero === item && styles.generoBtnTextAtivo]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Data de Nascimento *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="AAAA-MM-DD"
                    value={novaDataNascimento}
                    onChangeText={(value) => setNovaDataNascimento(formatBirthDateInput(value))}
                    editable={!criando}
                    keyboardType="number-pad"
                    placeholderTextColor={COLORS.textSecondary}
                    maxLength={10}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Provincia</Text>
                  <TouchableOpacity
                    style={styles.formInput}
                    onPress={() => {
                      setProvinciaTarget('create');
                      setModalProvincia(true);
                      setModalCriar(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: novaProvincia ? COLORS.text : COLORS.textSecondary }}>
                      {novaProvincia || 'Selecionar provincia'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.formNote}>* Campos obrigatorios</Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.botaoModal, styles.botaoCancelar]} onPress={() => setModalCriar(false)} disabled={criando}>
                  <Text style={styles.botaoModalText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botaoModal, styles.botaoConfirmar]} onPress={handleCriar} disabled={criando}>
                  {criando ? (
                    <ActivityIndicator color={COLORS.textInverse} />
                  ) : (
                    <Text style={[styles.botaoModalText, { color: COLORS.textInverse }]}>Criar Secretario</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={modalSenha} animationType="fade" transparent onRequestClose={() => setModalSenha(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 24, alignItems: 'center' }]}>
            <Ionicons name="checkmark-circle" size={56} color="#22C55E" />
            <Text style={[styles.modalTitle, { marginTop: 12 }]}>Conta Criada!</Text>
            <Text style={styles.senhaInfo}>
              Secretario: <Text style={{ fontWeight: '700' }}>{nomeParaSenha}</Text>
            </Text>
            <Text style={styles.senhaInfo}>Senha temporaria (ja copiada):</Text>
            <View style={styles.senhaBox}>
              <Text style={styles.senhaTexto}>{senhaGerada}</Text>
              <TouchableOpacity onPress={async () => { await Clipboard.setStringAsync(senhaGerada); Toast.show({ type: 'success', text1: 'Copiado!' }); }}>
                <Ionicons name="copy-outline" size={20} color="#7C3AED" />
              </TouchableOpacity>
            </View>
            <Text style={styles.senhaAviso}>
              Guarde esta senha. O secretario devera altera-la no primeiro acesso.
            </Text>
            <TouchableOpacity style={[styles.botaoModal, styles.botaoConfirmar, { marginTop: 16, width: '100%' }]} onPress={() => setModalSenha(false)}>
              <Text style={[styles.botaoModalText, { color: COLORS.textInverse }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEditar} animationType="slide" transparent onRequestClose={() => setModalEditar(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Secretario</Text>
                <TouchableOpacity onPress={() => setModalEditar(false)}>
                  <Ionicons name="close" size={28} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nome Completo *</Text>
                  <TextInput style={styles.formInput} value={editNome} onChangeText={setEditNome} editable={!salvando} placeholderTextColor={COLORS.textSecondary} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Telefone</Text>
                  <TextInput style={styles.formInput} value={editTelefone} onChangeText={setEditTelefone} keyboardType="phone-pad" editable={!salvando} placeholderTextColor={COLORS.textSecondary} />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Sexo / Genero *</Text>
                  <View style={styles.generoRow}>
                    {GENEROS.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.generoBtn, editGenero === item && styles.generoBtnAtivo]}
                        onPress={() => setEditGenero(item)}
                        disabled={salvando}
                      >
                        <Text style={[styles.generoBtnText, editGenero === item && styles.generoBtnTextAtivo]}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Data de Nascimento *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editDataNascimento}
                    onChangeText={(value) => setEditDataNascimento(formatBirthDateInput(value))}
                    keyboardType="number-pad"
                    editable={!salvando}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={COLORS.textSecondary}
                    maxLength={10}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Provincia</Text>
                  <TouchableOpacity
                    style={styles.formInput}
                    onPress={() => {
                      setProvinciaTarget('edit');
                      setModalProvincia(true);
                      setModalEditar(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: editProvincia ? COLORS.text : COLORS.textSecondary }}>
                      {editProvincia || 'Selecionar provincia'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={[styles.botaoModal, styles.botaoCancelar]} onPress={() => setModalEditar(false)} disabled={salvando}>
                  <Text style={styles.botaoModalText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.botaoModal, styles.botaoConfirmar]} onPress={handleSalvarEdicao} disabled={salvando}>
                  {salvando ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={[styles.botaoModalText, { color: COLORS.textInverse }]}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={modalProvincia} animationType="slide" transparent onRequestClose={() => { setModalProvincia(false); provinciaTarget === 'create' ? setModalCriar(true) : setModalEditar(true); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingHorizontal: 0 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Provincia</Text>
              <TouchableOpacity onPress={() => { setModalProvincia(false); provinciaTarget === 'create' ? setTimeout(() => setModalCriar(true), 100) : setTimeout(() => setModalEditar(true), 100); }}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PROVINCIAS_ANGOLA}
              keyExtractor={(provincia) => provincia}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.provinciaItem}
                  onPress={() => {
                    if (provinciaTarget === 'create') setNovaProvincia(item);
                    else setEditProvincia(item);
                    setModalProvincia(false);
                    setTimeout(() => provinciaTarget === 'create' ? setModalCriar(true) : setModalEditar(true), 100);
                  }}
                >
                  <Text style={styles.provinciaText}>{item}</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerContent: {
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: TYPOGRAPHY.sizes.xl, fontWeight: '700', color: COLORS.text, flex: 1 },
  botaoAdicionar: { padding: 4 },

  buscaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    margin: SPACING.md,
    height: 44,
  },
  buscaInput: { flex: 1, color: COLORS.text, fontSize: 14 },

  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  listHeaderText: { fontSize: 13, fontWeight: '600', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.4 },

  lista: { paddingBottom: 40, paddingHorizontal: SPACING.md },
  webLista: { maxWidth: 900, width: '100%', alignSelf: 'center' },

  card: { backgroundColor: COLORS.surface, borderRadius: 14, marginBottom: SPACING.sm, overflow: 'hidden', ...SHADOWS.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  cardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F0FF', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardNome: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  menuToggle: { padding: 4 },

  acoes: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  acaoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: SPACING.sm },
  acaoBtnDelete: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.error },
  acaoBtnText: { color: COLORS.textInverse, fontWeight: '700', fontSize: 13 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  loadingText: { color: COLORS.textSecondary, fontSize: 14 },

  emptyContainer: { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  keyboardAvoidingView: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 16, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalForm: { padding: SPACING.md },
  modalFooter: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  botaoModal: { flex: 1, padding: SPACING.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  botaoCancelar: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  botaoConfirmar: { backgroundColor: '#7C3AED' },
  botaoModalText: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  formGroup: { marginBottom: SPACING.md },
  formLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  formInput: { backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, fontSize: 14, color: COLORS.text, minHeight: 46, justifyContent: 'center' },
  generoRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  generoBtn: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  generoBtnAtivo: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  generoBtnText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  generoBtnTextAtivo: { color: COLORS.textInverse },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, paddingRight: 12, height: 46 },
  passwordInput: { flex: 1, paddingHorizontal: SPACING.sm, fontSize: 14, color: COLORS.text },
  formNote: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },

  senhaInfo: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },
  senhaBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3F0FF', borderRadius: 12, padding: 14, marginTop: 8, width: '100%', justifyContent: 'space-between' },
  senhaTexto: { fontSize: 18, fontWeight: '700', color: '#7C3AED', letterSpacing: 2 },
  senhaAviso: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },

  provinciaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  provinciaText: { fontSize: 15, color: COLORS.text },
});

export default AdminSecretariosScreen;
