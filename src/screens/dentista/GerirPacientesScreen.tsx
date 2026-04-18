import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useAuth } from '../../contexts/AuthContext';
import { DentistaTabParamList } from '../../navigation/types';
import {
  atualizarPaciente,
  buscarPaciente,
  deletarPaciente,
  gerarCodigoPaciente,
  listarPacientes,
  resetarSenhaPaciente,
  calcularIdade,
  atribuirPacienteAoDentista,
  PacienteProfile,
} from '../../services/pacienteService';
import { listarDentistasPorEspecialidade } from '../../services/secretarioService';
import { gerarFichaHistorico } from './gerarFichaHistorico';
import { gerarFichaCadastroHTML } from '../../services/fichaService';
import { deleteImage, uploadImage } from '../../services/storageService';
import { COLORS, SHADOWS, SIZES, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { formatBirthDateInput, formatDate } from '../../utils/helpers';

const safeShadow = SHADOWS?.sm || {};

type Props = BottomTabScreenProps<DentistaTabParamList, 'Pacientes'>;

type FormData = {
  nome: string;
  telefone: string;
  email: string;
  data_nascimento: string;
  genero: string;
  provincia: string;
  endereco: string;
  historico_medico: string;
  alergias: string;
  medicamentos_atuais: string;
  observacoes_gerais: string;
  documentos_urls: string[];
};

const EMPTY_FORM: FormData = {
  nome: '',
  telefone: '',
  email: '',
  data_nascimento: '',
  genero: '',
  provincia: '',
  endereco: '',
  historico_medico: '',
  alergias: '',
  medicamentos_atuais: '',
  observacoes_gerais: '',
  documentos_urls: [],
};

const GerirPacientesScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [pacientes, setPacientes] = useState<PacienteProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<PacienteProfile | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [atribuirModalVisible, setAtribuirModalVisible] = useState(false);
  const [dentistas, setDentistas] = useState<any[]>([]);
  const [atribuindo, setAtribuindo] = useState(false);

  const carregarPacientes = useCallback(async () => {
    setLoading(true);
    // ✅ Apply role-based filtering
    const filtro = profile?.tipo === 'dentista' ? { dentist_id: user?.id } : {};
    const result = await listarPacientes(filtro);
    if (result.success && result.data) {
      setPacientes(result.data);
    } else {
      Toast.show({ type: 'error', text1: 'Erro ao carregar pacientes', text2: result.error || 'Tente novamente' });
    }
    setLoading(false);
  }, [profile?.tipo, user?.id]);

  useEffect(() => {
    void carregarPacientes();
  }, [carregarPacientes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarPacientes();
    setRefreshing(false);
  }, [carregarPacientes]);

  const pacientesVisiveis = useMemo(() => {
    if (profile?.tipo === 'dentista') {
      return pacientes.filter(
        (paciente) =>
          paciente.dentist_id === user?.id || paciente.dentista_id === user?.id
      );
    }
    return pacientes;
  }, [pacientes, profile?.tipo, user?.id]);

  const pacientesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return pacientesVisiveis;
    return pacientesVisiveis.filter((paciente) =>
      [paciente.nome, paciente.email, paciente.telefone].some((valor) =>
        valor?.toLowerCase().includes(termo)
      )
    );
  }, [busca, pacientesVisiveis]);

  const setField = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        field === 'data_nascimento' && typeof value === 'string'
          ? formatBirthDateInput(value)
          : value,
    } as FormData));
  };

  const abrirModalEdicao = async (pacienteId: string) => {
    const result = await buscarPaciente(pacienteId);
    if (!result.success || !result.data) {
Toast.show({ type: 'error', text1: 'Não foi possível abrir paciente', text2: result.error || 'Tente novamente' });
      return;
    }

    const paciente = result.data;
    setSelectedPaciente(paciente);
    setFormData({
      nome: paciente.nome || '',
      telefone: paciente.telefone || '',
      email: paciente.email || '',
      data_nascimento: paciente.data_nascimento || '',
      genero: paciente.genero || '',
      provincia: paciente.provincia || '',
              endereco: (paciente as PacienteProfile).endereco || '',
      historico_medico: paciente.historico_medico || '',
      alergias: paciente.alergias || '',
      medicamentos_atuais: paciente.medicamentos_atuais || '',
      observacoes_gerais: (paciente as PacienteProfile).observacoes_gerais || '',
      documentos_urls: Array.isArray((paciente as PacienteProfile).documentos_urls) ? (paciente as PacienteProfile).documentos_urls : [],
    });
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setQrVisible(false);
    setSelectedPaciente(null);
    setFormData(EMPTY_FORM);
  };

  const salvarPaciente = async () => {
    if (!selectedPaciente?.id) return;
if (!formData.nome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome é obrigatório' });
      return;
    }

    setSaving(true);
    const result = await atualizarPaciente(selectedPaciente.id, {
      nome: formData.nome.trim(),
      telefone: formData.telefone.trim() || undefined,
      data_nascimento: formData.data_nascimento.trim() || undefined,
      genero: (formData.genero.trim() as any) || undefined,
      provincia: formData.provincia.trim() || undefined,
      endereco: formData.endereco.trim() || undefined,
      historico_medico: formData.historico_medico.trim() || undefined,
      alergias: formData.alergias.trim() || undefined,
      medicamentos_atuais: formData.medicamentos_atuais.trim() || undefined,
      observacoes_gerais: formData.observacoes_gerais.trim() || undefined,
      documentos_urls: formData.documentos_urls,
    });
    setSaving(false);

    if (!result.success) {
      Toast.show({ type: 'error', text1: 'Erro ao salvar', text2: result.error || 'Tente novamente' });
      return;
    }

    Toast.show({ type: 'success', text1: 'Ficha do paciente atualizada' });
    await carregarPacientes();
    if (selectedPaciente.id) {
      const refreshed = await buscarPaciente(selectedPaciente.id);
      if (refreshed.success && refreshed.data) {
        setSelectedPaciente(refreshed.data);
      }
    }
  };

  const abrirModalAtribuicao = async (paciente: PacienteProfile) => {
    setSelectedPaciente(paciente);
    setLoading(true);
    const result = await listarDentistasPorEspecialidade();
    setLoading(false);
    
    if (result.success && result.data) {
      setDentistas(result.data);
      setAtribuirModalVisible(true);
    } else {
      Toast.show({ type: 'error', text1: 'Erro ao carregar dentistas', text2: result.error });
    }
  };

  const confirmarAtribuicao = async (dentistaId: string | null) => {
    if (!selectedPaciente) return;
    
    setAtribuindo(true);
    const result = await atribuirPacienteAoDentista(selectedPaciente.id, dentistaId);
    setAtribuindo(false);
    
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Atribuição atualizada com sucesso' });
      setSelectedPaciente((prev) => prev ? { ...prev, dentist_id: dentistaId, dentista_id: dentistaId } : prev);
      setAtribuirModalVisible(false);
      await carregarPacientes();
    } else {
      Toast.show({ type: 'error', text1: 'Falha na atribuição', text2: result.error });
    }
  };

  const handleExcluir = (paciente: PacienteProfile) => {
    const confirmar = async () => {
      try {
        Toast.show({ type: 'info', text1: 'Excluindo...', text2: paciente.nome || '' });
        const result = await deletarPaciente(paciente.id);
        if (!result.success) {
          Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha na exclusão' });
          return;
        }
        Toast.show({ type: 'success', text1: `Paciente ${paciente.nome} excluído` });
        await carregarPacientes();
      } catch (error: any) {
        Toast.show({ type: 'error', text1: 'Erro inesperado', text2: error.message || 'Falha na exclusão' });
      }
    };

    if (Platform.OS === 'web') {
      const msg = `Excluir permanentemente ${paciente.nome}?\n\nEsta ação remove todos dados, agendamentos, mensagens e triagens.`;
      const ok = (typeof window !== 'undefined') ? window.confirm(msg) : false;
      if (ok) confirmar();
      return;
    }

    Alert.alert(
      'Confirmar exclusão', 
      `Excluir permanentemente ${paciente.nome}?\n\nEsta ação remove todos dados, agendamentos, mensagens e triagens.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir tudo', style: 'destructive', onPress: confirmar },
      ]
    );
  };

  const handleImprimirFicha = async (paciente: PacienteProfile) => {
    try {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Nova Ficha',
          'Gerar uma nova ficha irá invalidar a senha anterior e criar uma nova. Deseja continuar?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Gerar Nova Senha', onPress: () => processarResetFicha(paciente) }
          ]
        );
      } else {
        const ok = window.confirm('Gerar uma nova ficha irá resetar a senha do paciente. Continuar?');
        if (ok) processarResetFicha(paciente);
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro ao preparar ficha', text2: error.message });
    }
  };

  const processarResetFicha = async (paciente: PacienteProfile) => {
    try {
      setLoading(true);
      Toast.show({ type: 'info', text1: 'Resetando senha...', text2: 'Gerando novas credenciais' });
      
      const resetResult = await resetarSenhaPaciente(paciente.id);
      if (!resetResult.success || !resetResult.newPassword) {
        throw new Error(resetResult.error || 'Falha ao resetar senha');
      }

      Toast.show({ type: 'info', text1: 'Gerando PDF...', text2: 'Aguarde um instante' });
      const html = await gerarFichaCadastroHTML(
        paciente,
        paciente.email || '',
        resetResult.newPassword,
        user?.user_metadata?.nome || 'Dentista',
        profile?.tipo || 'dentista'
      );
      
      const result = await exportHtmlAsPdf(html, `ficha_${paciente.nome || 'paciente'}.pdf`);
      if (!result.success) {
        console.error('❌ PDF Export Error:', result.error);
        Toast.show({ 
          type: 'error', 
          text1: 'Erro ao gerar PDF', 
          text2: Platform.OS === 'web' ? 'Verifique se o seu navegador bloqueou o pop-up ou tente outro navegador.' : (result.error || 'Tente novamente')
        });
      } else {
        Toast.show({ type: 'success', text1: 'Ficha gerada!', text2: Platform.OS === 'web' ? 'Verifique a nova aba ou downloads' : 'Nova senha ativa' });
      }
      
      // Recarregar lista para mostrar a nova senha no card
      await carregarPacientes();
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro ao imprimir ficha', text2: error.message || 'Tente novamente' });
    } finally {
      setLoading(false);
    }
  };

  const handleImprimirHistorico = async (paciente: PacienteProfile) => {
    try {
      Toast.show({ type: 'info', text1: 'Gerando PDF...' });
      const html = await gerarFichaHistorico(paciente.id);
      const result = await exportHtmlAsPdf(html, `historico_${paciente.nome || 'paciente'}.pdf`);
      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Erro ao gerar PDF', text2: result.error || 'Tente novamente' });
        return;
      }
      Toast.show({ type: 'success', text1: 'PDF gerado com sucesso' });
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro ao imprimir historico', text2: error.message || 'Tente novamente' });
    }
  };

  const handleAdicionarDocumento = async () => {
    if (!selectedPaciente?.id || uploading) return;
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissao.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permissao negada para acessar imagens' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    const uploadResult = await uploadImage(result.assets[0].uri, selectedPaciente.id, 'triagens');
    setUploading(false);

    if (!uploadResult.success || !uploadResult.url) {
Toast.show({ type: 'error', text1: 'Falha ao enviar documento', text2: uploadResult.error || 'Tente novamente' });
      return;
    }

    setField('documentos_urls', [...formData.documentos_urls, uploadResult.url]);
    Toast.show({ type: 'success', text1: 'Documento adicionado', text2: 'Salve a ficha para persistir a alteracao.' });
  };

  const handleRemoverDocumento = async (url: string) => {
    const path = url.split('/').slice(-2).join('/');
    setField('documentos_urls', formData.documentos_urls.filter((item) => item !== url));
    if (path) {
      await deleteImage(path, 'triagens');
    }
  };

  const copiarCodigoPaciente = async () => {
    if (!selectedPaciente?.id) return;
    await Clipboard.setStringAsync(gerarCodigoPaciente(selectedPaciente.id));
    Toast.show({ type: 'success', text1: 'Codigo do paciente copiado' });
  };

  const renderPaciente = ({ item }: { item: PacienteProfile }) => {
    const codigo = gerarCodigoPaciente(item.id);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.nome?.charAt(0)?.toUpperCase() || 'P'}</Text>
          </View>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle}>{item.nome}</Text>
            <View style={styles.rowInfo}>
              <Text style={styles.cardSubtitle}>{item.email}</Text>
            </View>

            {(!!item.data_nascimento || !!item.genero) && (
              <View style={styles.detailsRow}>
                {!!item.data_nascimento && (
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>DN: {formatDate(item.data_nascimento)}</Text>
                  </View>
                )}
                {!!item.genero && (
                  <View style={styles.detailItem}>
                    <Ionicons name="person-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>Sexo: {item.genero}</Text>
                  </View>
                )}
                {!!item.data_nascimento && (
                  <View style={styles.detailItem}>
                    <Ionicons name="gift-outline" size={12} color={COLORS.secondary} />
                    <Text style={[styles.detailText, { color: COLORS.secondary, fontWeight: 'bold' }]}>
                      {calcularIdade(item.data_nascimento)} anos
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* ✅ Role-based view: Show assigned dentist */}
            <View style={[styles.detailsRow, { marginTop: 8 }]}>
              <View style={styles.detailItem}>
                <Ionicons 
                  name={item.dentist_id || item.dentista_id ? "checkmark-circle" : "close-circle-outline"} 
                  size={14} 
                  color={item.dentist_id || item.dentista_id ? COLORS.success || '#059669' : '#DC2626'} 
                />
                <Text style={[styles.detailText, { color: item.dentist_id || item.dentista_id ? COLORS.success || '#059669' : '#DC2626', fontWeight: item.dentist_id || item.dentista_id ? '700' : '700' }]}> 
                  {item.dentist_id || item.dentista_id ? 'Atribuído' : 'Não atribuído'}
                </Text>
              </View>
            </View>

            {!!item.temp_password && (
              <View style={styles.tempPassBox}>
                <Ionicons name="key-outline" size={14} color={COLORS.secondary} />
                <Text style={styles.tempPassText}>Senha: {item.temp_password}</Text>
              </View>
            )}
            {!!item.telefone && <Text style={styles.cardMeta}>{item.telefone}</Text>}
            <Text style={styles.cardCode}>{codigo}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {profile?.tipo !== 'secretario' && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={() => navigation.getParent<any>()?.navigate('PacienteHistorico', { pacienteId: item.id, pacienteNome: item.nome })}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                <Text style={styles.actionText}>Historico</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleImprimirHistorico(item)}>
                <Ionicons name="print-outline" size={18} color={COLORS.accent} />
                <Text style={styles.actionText}>Historico</Text>
              </TouchableOpacity>
            </>
          )}
          {profile?.tipo === 'secretario' && (
            <TouchableOpacity style={styles.actionButton} onPress={() => abrirModalEdicao(item.id)}>
              <Ionicons name="create-outline" size={18} color={COLORS.secondary} />
              <Text style={styles.actionText}>Gerir</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionButton} onPress={() => handleImprimirFicha(item)}>
            <Ionicons name="qr-code-outline" size={18} color={COLORS.primary} />
            <Text style={styles.actionText}>Ficha</Text>
          </TouchableOpacity>
          {profile?.tipo === 'secretario' && (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleExcluir(item)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>Excluir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  const codigoPaciente = selectedPaciente?.id ? gerarCodigoPaciente(selectedPaciente.id) : '';

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar paciente"
          placeholderTextColor={COLORS.textLight}
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={pacientesFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderPaciente}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {profile?.tipo === 'dentista'
                ? 'Nenhum paciente atribuído a você no momento.'
                : 'Nenhum paciente encontrado'}
            </Text>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={fecharModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ficha do paciente</Text>
              <TouchableOpacity onPress={fecharModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryName}>{formData.nome || 'Paciente'}</Text>
                <Text style={styles.summaryCode}>{codigoPaciente}</Text>
                <View style={styles.summaryActions}>
                  <TouchableOpacity style={styles.summaryButton} onPress={() => setQrVisible(true)}>
                    <Ionicons name="qr-code-outline" size={18} color={COLORS.secondary} />
                    <Text style={styles.summaryButtonText}>QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.summaryButton} onPress={copiarCodigoPaciente}>
                    <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.summaryButtonText}>Copiar codigo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.summaryButton} onPress={() => navigation.getParent<any>()?.navigate('PacienteHistorico', { pacienteId: selectedPaciente?.id, pacienteNome: formData.nome })}>
                    <Ionicons name="time-outline" size={18} color={COLORS.accent} />
                    <Text style={styles.summaryButtonText}>Historico</Text>
                  </TouchableOpacity>
                </View>
                
                {!!selectedPaciente?.temp_password && (
                  <View style={[styles.tempPassBox, { marginTop: 15, paddingHorizontal: 12, paddingVertical: 6 }]}>
                    <Ionicons name="key" size={16} color={COLORS.secondary} />
                    <Text style={[styles.tempPassText, { fontSize: 16 }]}>Senha Temporária: {selectedPaciente.temp_password}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitle}>Dados essenciais</Text>
              {[
                ['nome', 'Nome completo'],
                ['email', 'Email'],
                ['telefone', 'Telefone'],
                ['data_nascimento', 'Data de nascimento'],
                ['genero', 'Sexo'],
                ['provincia', 'Provincia'],
              ].map(([field, label]) => (
                <View key={field} style={styles.field}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.fieldLabel}>{label}</Text>
                    {field === 'data_nascimento' && formData.data_nascimento.length >= 10 && (
                      <Text style={{ fontSize: 12, color: COLORS.secondary, fontWeight: 'bold' }}>
                        {calcularIdade(formData.data_nascimento)} anos
                      </Text>
                    )}
                  </View>
                  <TextInput
                    value={formData[field as keyof FormData] as string}
                    onChangeText={(value) => setField(field as keyof FormData, value)}
                    style={[styles.fieldInput, profile?.tipo !== 'secretario' && styles.fieldInputDisabled]}
                    placeholder={label}
                    placeholderTextColor={COLORS.textLight}
                    editable={field !== 'email' && profile?.tipo === 'secretario'}
                    keyboardType={field === 'data_nascimento' ? 'number-pad' : 'default'}
                  />
                </View>
              ))}

              <Text style={styles.sectionTitle}>Dados clinicos</Text>
              {[
                ['historico_medico', 'Historico medico'],
                ['alergias', 'Alergias'],
                ['medicamentos_atuais', 'Medicacoes em uso'],
                ['observacoes_gerais', 'Observacoes gerais'],
              ].map(([field, label]) => (
                <View key={field} style={styles.field}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    value={formData[field as keyof FormData] as string}
                    onChangeText={(value) => setField(field as keyof FormData, value)}
                    style={[styles.fieldInput, styles.fieldMultiline]}
                    placeholder={label}
                    placeholderTextColor={COLORS.textLight}
                    multiline
                  />
                </View>
              ))}

              <View style={styles.documentsHeader}>
                <Text style={styles.sectionTitle}>Documentos e imagens</Text>
                <TouchableOpacity style={styles.uploadButton} onPress={handleAdicionarDocumento} disabled={uploading}>
                  <Ionicons name="cloud-upload-outline" size={18} color={COLORS.textInverse} />
                  <Text style={styles.uploadButtonText}>{uploading ? 'Enviando' : 'Adicionar'}</Text>
                </TouchableOpacity>
              </View>

              {!formData.documentos_urls.length ? (
                <Text style={styles.emptyText}>Sem documentos anexados.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docsRow}>
                  {formData.documentos_urls.map((url) => (
                    <View key={url} style={styles.docCard}>
                      <Image source={{ uri: url }} style={styles.docImage} />
                      <TouchableOpacity style={styles.removeDocButton} onPress={() => handleRemoverDocumento(url)}>
                        <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={salvarPaciente} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Salvando...' : 'Salvar ficha do paciente'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <Text style={styles.modalTitle}>QR individual do paciente</Text>
            <View style={styles.qrBox}>
              {!!selectedPaciente?.id && (
                <QRCode 
                  value={`PACIENTE:${selectedPaciente.id}:${codigoPaciente}`} 
                  size={200} 
                  color="#000" 
                  backgroundColor="#FFF"
quietZone={1}
                />
              )}
              {!selectedPaciente?.id && (
                <Text style={styles.qrLoading}>Carregando QR...</Text>
              )}
            </View>
            <Text style={styles.qrCodeText}>{codigoPaciente}</Text>
            <TouchableOpacity style={styles.saveButton} onPress={() => setQrVisible(false)}>
              <Text style={styles.saveButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal de Atribuição de Dentista (Secretaria) ── */}
      <Modal visible={atribuirModalVisible} transparent animationType="fade" onRequestClose={() => setAtribuirModalVisible(false)}>
        <View style={styles.qrOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Atribuir Dentista</Text>
                <Text style={[styles.cardSubtitle, { marginTop: 4 }]}>Paciente: {selectedPaciente?.nome}</Text>
              </View>
              <TouchableOpacity onPress={() => setAtribuirModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={[styles.dentistaSelectItem, !selectedPaciente?.dentist_id && styles.dentistaSelected]} 
                onPress={() => confirmarAtribuicao(null)}
              >
                <View style={styles.dentistaSelectIcon}>
                  <Ionicons name="close-circle-outline" size={20} color={!selectedPaciente?.dentist_id ? 'white' : COLORS.textSecondary} />
                </View>
                <Text style={[styles.dentistaSelectText, !selectedPaciente?.dentist_id && { color: 'white' }]}>Remover Atribuição</Text>
              </TouchableOpacity>

              {dentistas.map((d) => (
                <TouchableOpacity 
                  key={d.id} 
                  style={[styles.dentistaSelectItem, selectedPaciente?.dentist_id === d.id && styles.dentistaSelected]} 
                  onPress={() => confirmarAtribuicao(d.id)}
                  disabled={atribuindo}
                >
                  <View style={styles.dentistaSelectInfo}>
                    <Text style={[styles.dentistaSelectName, selectedPaciente?.dentist_id === d.id && { color: 'white' }]}>
                      Dr(a). {d.nome}
                    </Text>
                    <Text style={[styles.dentistaSelectSub, selectedPaciente?.dentist_id === d.id && { color: 'rgba(255,255,255,0.8)' }]}>
                      {d.especialidade || 'Clínica Geral'}
                    </Text>
                  </View>
                  {selectedPaciente?.dentist_id === d.id && (
                    <Ionicons name="checkmark-circle" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {atribuindo && (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginTop: 10 }} />
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.lg },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.fontMd },
  searchBox: {
    margin: SIZES.md,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    ...safeShadow,
  },
  searchInput: { flex: 1, marginLeft: SIZES.sm, color: COLORS.text, fontSize: SIZES.fontMd },
  listContent: { paddingHorizontal: SIZES.md, paddingBottom: SIZES.xxl },
  card: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SIZES.md, marginBottom: SIZES.md, ...safeShadow },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.sm,
  },
  avatarText: { color: COLORS.textInverse, fontWeight: '700', fontSize: SIZES.fontLg },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: SIZES.fontLg, fontWeight: '700', color: COLORS.text },
  rowInfo: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardSubtitle: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginTop: 2, marginBottom: 4 },
  cardMeta: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginTop: 2 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  tempPassBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#E8F5E9', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 4, 
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 4
  },
  tempPassText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  cardCode: { fontSize: SIZES.fontXs, color: COLORS.secondary, fontWeight: '700', marginTop: 4 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.md },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.sm,
  },
  actionText: { marginLeft: 6, color: COLORS.text, fontSize: SIZES.fontSm, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: SIZES.md },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SIZES.md, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
  modalTitle: { fontSize: SIZES.fontLg, fontWeight: '700', color: COLORS.text },
  summaryBox: { backgroundColor: COLORS.background, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
  summaryName: { fontSize: SIZES.fontLg, fontWeight: '700', color: COLORS.text },
  summaryCode: { fontSize: SIZES.fontSm, fontWeight: '700', color: COLORS.secondary, marginTop: 4 },
  summaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.md },
  summaryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.sm, paddingVertical: SIZES.sm },
  summaryButtonText: { marginLeft: 6, fontSize: SIZES.fontSm, color: COLORS.text, fontWeight: '600' },
  sectionTitle: { fontSize: SIZES.fontMd, fontWeight: '700', color: COLORS.text, marginBottom: SIZES.sm, marginTop: SIZES.sm },
  field: { marginBottom: SIZES.md },
  fieldLabel: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.md,
    color: COLORS.text,
  },
  fieldInputDisabled: {
    backgroundColor: '#F5F7FA',
    borderColor: '#E4E7EB',
    color: COLORS.textSecondary,
  },
  fieldMultiline: { minHeight: 88, textAlignVertical: 'top' },
  documentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  uploadButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.secondary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.sm, paddingVertical: SIZES.sm },
  uploadButtonText: { color: COLORS.textInverse, marginLeft: 6, fontWeight: '700', fontSize: SIZES.fontSm },
  docsRow: { marginBottom: SIZES.md },
  docCard: { width: 110, height: 110, marginRight: SIZES.sm, borderRadius: SIZES.radiusMd, overflow: 'hidden', backgroundColor: COLORS.backgroundSecondary },
  docImage: { width: '100%', height: '100%' },
  removeDocButton: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusFull },
  saveButton: { marginTop: SIZES.sm, backgroundColor: COLORS.secondary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: COLORS.textInverse, fontWeight: '700', fontSize: SIZES.fontMd },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: SIZES.md },
  qrCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SIZES.lg, alignItems: 'center', width: '90%' },
  qrBox: { backgroundColor: COLORS.surface, padding: SIZES.md, borderRadius: SIZES.radiusMd, marginVertical: SIZES.md },
qrCodeText: { fontSize: SIZES.fontMd, color: COLORS.text, fontWeight: '700' },
qrLoading: { color: COLORS.textSecondary, fontSize: SIZES.fontSm },
dentistaSelectItem: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderRadius: 12,
  backgroundColor: COLORS.background,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: COLORS.border,
},
dentistaSelected: {
  backgroundColor: COLORS.secondary,
  borderColor: COLORS.secondary,
},
dentistaSelectIcon: {
  marginRight: 12,
},
dentistaSelectInfo: {
  flex: 1,
},
dentistaSelectName: {
  fontSize: 16,
  fontWeight: '700',
  color: COLORS.text,
},
dentistaSelectSub: {
  fontSize: 12,
  color: COLORS.textSecondary,
  marginTop: 2,
},
dentistaSelectText: {
  fontSize: 16,
  fontWeight: '600',
  color: COLORS.textSecondary,
},
});

export default GerirPacientesScreen;
