import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator as _ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// ActivityIndicator may not exist in some environments (web shims); use
// a no-op fallback to avoid runtime ReferenceError.
const ActivityIndicator: React.ComponentType<any> =
  _ActivityIndicator || (() => null);
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDentist } from '../../contexts/DentistContext';
import { PROFILE_SCHEMA_FEATURES } from '../../config/supabase';
import { buscarPaciente, parsePacienteProfile, validarData } from '../../services/pacienteService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { PROVINCIAS_ANGOLA } from '../../utils/constants';
import { getInitials, formatDate } from '../../utils/helpers';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';
import { gerarFichaHistorico } from '../dentista/gerarFichaHistorico';

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

const PerfilScreen: React.FC<any> = ({ navigation }) => {
  const route: any = useRoute();
  const forceEdit: boolean = !!route.params?.forceEdit;

  const { profile, updateProfile, signOut, refreshProfile } = useAuth();
  const { requestAutoOpenChooseDentist } = useDentist();
  const [editando, setEditando] = useState<boolean>(forceEdit);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  useEffect(() => {
    if (forceEdit && (!profile?.telefone || !profile?.provincia)) {
      setEditando(true);
    }
  }, [forceEdit, profile]);

  const [showProvincias, setShowProvincias] = useState<boolean>(false);
  const [showEspecialidades, setShowEspecialidades] = useState<boolean>(false);
  const canEditProvincia =
    PROFILE_SCHEMA_FEATURES.hasProvincia || PROFILE_SCHEMA_FEATURES.usesProvinciaId;
  
  // Campos editáveis
  const [nome, setNome] = useState<string>(profile?.nome || '');
  const [telefone, setTelefone] = useState<string>(profile?.telefone || '');
  const [provincia, setProvincia] = useState<string>(profile?.provincia || '');
  const [crm, setCrm] = useState<string>(profile?.crm || profile?.numero_registro || '');
  const [especialidade, setEspecialidade] = useState<string>(profile?.especialidade || '');
  const [idade, setIdade] = useState<string>('');
  const [genero, setGenero] = useState<string>(profile?.genero || '');
  const [processandoLogout, setProcessandoLogout] = useState(false);
  const [showGeneros, setShowGeneros] = useState<boolean>(false);
  const [perfilCarregado, setPerfilCarregado] = useState<any>(null);
  const isDentista = profile?.tipo === 'dentista' || profile?.tipo === 'medico';
  const perfilPaciente = useMemo(
    () => (!isDentista && (perfilCarregado || profile) ? parsePacienteProfile({ ...(perfilCarregado || profile) }) : profile),
    [isDentista, perfilCarregado, profile]
  );
  const idadePaciente = useMemo(() => {
    if (isDentista) return null;
    if (typeof perfilPaciente?.idade === 'number' && perfilPaciente.idade >= 0) {
      return perfilPaciente.idade;
    }
    if (perfilPaciente?.data_nascimento && validarData(perfilPaciente.data_nascimento)) {
      const anoNascimento = Number(String(perfilPaciente.data_nascimento).split('-')[0]);
      const anoAtual = new Date().getFullYear();
      return Number.isFinite(anoNascimento) && anoNascimento > 1900 ? anoAtual - anoNascimento : null;
    }
    return null;
  }, [isDentista, perfilPaciente]);

  useEffect(() => {
    const carregarPerfilCompleto = async () => {
      if (isDentista || !profile?.id) return;
      const result = await buscarPaciente(profile.id, { forceRefresh: true });
      if (result.success && result.data) {
        setPerfilCarregado(result.data);
      }
    };

    void carregarPerfilCompleto();
  }, [isDentista, profile?.id]);

  useEffect(() => {
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setProvincia(profile?.provincia || '');
    if (isDentista) {
      setCrm(profile?.crm || profile?.numero_registro || '');
      setEspecialidade(profile?.especialidade || '');
    } else {
      setIdade(
        typeof perfilPaciente?.idade === 'number' && perfilPaciente.idade >= 0
          ? String(perfilPaciente.idade)
          : ''
      );
      setGenero(perfilPaciente?.genero || '');
    }
  }, [isDentista, perfilPaciente, profile]);

  const handleSalvar = async () => {
    if (forceEdit && (!telefone.trim() || !provincia.trim())) {
      Toast.show({ type: 'error', text1: 'Telefone e província são obrigatórios' });
      return;
    }
    const updates: Record<string, any> = {
      nome: nome.trim(),
      telefone: telefone.trim(),
    };
    if (!nome.trim()) {
      Toast.show({ type: 'error', text1: 'Nome obrigatorio' });
      return;
    }
    if (isDentista) {
      if (!especialidade.trim()) {
        Toast.show({ type: 'error', text1: 'Especialidade obrigatoria' });
        return;
      }
      if (!crm.trim()) {
        Toast.show({ type: 'error', text1: 'CRM obrigatorio' });
        return;
      }
      updates.crm = crm.trim();
      updates.numero_registro = crm.trim();
      updates.especialidade = especialidade.trim();
    } else {
      const idadeLimpa = idade.trim();
      const generoLimpo = genero.trim();

      if (idadeLimpa && /^\d{1,3}$/.test(idadeLimpa)) {
        updates.idade = Number(idadeLimpa);
      }

      if (generoLimpo) {
        updates.genero = generoLimpo;
      }
    }

    if (canEditProvincia) {
      updates.provincia = provincia;
    }

    setSalvandoPerfil(true);
    try {
      const result = await updateProfile(updates);
      if (result.success) {
        await refreshProfile();
        setEditando(false);
        Toast.show({ type: 'success', text1: 'Dados atualizados com sucesso' });
        if (forceEdit) {
          requestAutoOpenChooseDentist();
          navigation.replace('PacienteMain');
        }
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao salvar',
          text2: (result as any)?.error?.message || 'Nao foi possivel salvar os dados',
        });
      }
    } finally {
      setSalvandoPerfil(false);
    }
  };
  
  const handleGerarPDF = async () => {
    if (!profile?.id) return;
    setBaixandoPdf(true);
    try {
      Toast.show({ type: 'info', text1: 'Gerando PDF...', text2: 'Aguarde um instante' });
      const html = await gerarFichaHistorico(profile.id);
      const result = await exportHtmlAsPdf(html, `ficha_${profile.nome || 'paciente'}.pdf`);
      if (result.success) {
        Toast.show({ type: 'success', text1: 'PDF gerado com sucesso' });
      } else {
        Toast.show({ type: 'error', text1: 'Erro ao gerar PDF', text2: result.error });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro inesperado', text2: error.message });
    } finally {
      setBaixandoPdf(false);
    }
  };

  const handleCancelar = () => {
    setNome(profile?.nome || '');
    setTelefone(profile?.telefone || '');
    setProvincia(profile?.provincia || '');
    if (isDentista) {
      setCrm(profile?.crm || profile?.numero_registro || '');
      setEspecialidade(profile?.especialidade || '');
    } else {
      setIdade(
        typeof perfilPaciente?.idade === 'number' && perfilPaciente.idade >= 0
          ? String(perfilPaciente.idade)
          : ''
      );
      setGenero(perfilPaciente?.genero || '');
    }
    setEditando(false);
  };

  const executarLogout = async () => {
    setProcessandoLogout(true);
    try {
      await signOut();
    } finally {
      setProcessandoLogout(false);
    }
  };

  const handleLogout = () => {
    if (forceEdit) {
      Toast.show({ type: 'info', text1: 'Complete seu perfil antes de sair' });
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis !== 'undefined' && typeof (globalThis as any).confirm === 'function'
          ? (globalThis as any).confirm('Tem certeza que deseja sair?')
          : true;
      if (!confirmed) return;
      executarLogout();
      return;
    }

    Alert.alert(
      'Sair da conta',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: executarLogout,
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
    >
      <View style={[styles.header, isDentista && styles.headerDentista]}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{getInitials(profile?.nome)}</Text>
        </View>
        <Text style={styles.headerNome}>{profile?.nome || 'Usuario'}</Text>
        <Text style={styles.headerEmail}>{profile?.email}</Text>
        {!isDentista && idadePaciente !== null && (
          <Text style={styles.headerExtra}>{idadePaciente} anos</Text>
        )}
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
      
      {salvandoPerfil && (
        <View style={styles.savingBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.savingBannerText}>Salvando alteracoes...</Text>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dados Pessoais</Text>
          {!forceEdit && (
            <TouchableOpacity onPress={() => setEditando(!editando)}>
              <Ionicons
                name={editando ? 'close' : 'create-outline'}
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          )}
        </View>

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

        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Email</Text>
          <Text style={styles.campoValor}>{profile?.email || '-'}</Text>
        </View>

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

        {!isDentista && (
          <>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Idade</Text>
              {editando ? (
                <TextInput
                  style={styles.input}
                  value={idade}
                  onChangeText={(v) => setIdade(v.replace(/\D/g, '').slice(0, 3))}
                  placeholder="idade (exemplo 25)"
                  keyboardType="numeric"
                  maxLength={3}
                />
              ) : (
                <Text style={styles.campoValor}>{idadePaciente !== null ? `${idadePaciente} anos` : '-'}</Text>
              )}
            </View>
            <View style={styles.campo}>
              <Text style={styles.campoLabel}>Gênero / Sexo</Text>
              {editando ? (
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setShowGeneros(true)}
                >
                  <Text style={[styles.selectText, !genero && styles.selectPlaceholder]}>
                    {genero || 'Selecione'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              ) : (
                <Text style={styles.campoValor}>{perfilPaciente?.genero || '-'}</Text>
              )}
            </View>
            
          </>
        )}

        {!isDentista && canEditProvincia && (
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
      </View>

      {isDentista && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informações Profissionais</Text>
          </View>

          <View style={styles.campo}>
            <Text style={styles.campoLabel}>CRM / Registro</Text>
            {editando ? (
              <TextInput
                style={styles.input}
                value={crm}
                onChangeText={setCrm}
                placeholder="CRM do dentista"
              />
            ) : (
              <Text style={styles.campoValor}>{profile?.crm || profile?.numero_registro || '-'}</Text>
            )}
          </View>

          <View style={styles.campo}>
            <Text style={styles.campoLabel}>Especialidade</Text>
            {editando ? (
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowEspecialidades(true)}
              >
                <Text style={[styles.selectText, !especialidade && styles.selectPlaceholder]}>
                  {especialidade || 'Selecione'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.campoValor}>{profile?.especialidade || '-'}</Text>
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
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.campo}>
          <Text style={styles.campoLabel}>Membro desde</Text>
          <Text style={styles.campoValor}>
            {profile?.created_at ? formatDate(profile.created_at, 'MMMM yyyy') : '-'}
          </Text>
        </View>

        {editando && (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.editButton, styles.cancelButton]}
              onPress={handleCancelar}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editButton,
                styles.saveButton,
                salvandoPerfil && styles.buttonDisabled,
              ]}
              onPress={handleSalvar}
              disabled={salvandoPerfil}
            >
              <Text style={styles.saveButtonText}>
                {salvandoPerfil ? 'Salvando...' : 'Salvar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

{!forceEdit && !isDentista && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentação</Text>
            <TouchableOpacity 
              style={styles.opcaoItem} 
              onPress={handleGerarPDF}
              disabled={baixandoPdf}
            >
              <Ionicons name="document-outline" size={22} color={COLORS.primary} />
              <Text style={[styles.opcaoText, { color: COLORS.primary, fontWeight: 'bold' }]}>
                {baixandoPdf ? 'Gerando Ficha...' : 'Baixar Ficha (PDF)'}
              </Text>
              {baixandoPdf ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="download-outline" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
        )}

        {!forceEdit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configurações</Text>

          <TouchableOpacity
            style={styles.opcaoItem}
            onPress={() => navigation.getParent()?.navigate('Notificacoes' as any)}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.opcaoText}>Notificações</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.opcaoItem}
            onPress={() => navigation.getParent()?.navigate('Privacidade' as any)}
          >
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.opcaoText}>Privacidade</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.opcaoItem}
            onPress={() => navigation.getParent()?.navigate('Ajuda' as any)}
          >
            <Ionicons name="help-circle-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.opcaoText}>Ajuda</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.opcaoItem}
            onPress={() => navigation.getParent()?.navigate('TermosUso' as any)}
          >
            <Ionicons name="document-text-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.opcaoText}>Termos de Uso</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {!forceEdit && (
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={processandoLogout}
        >
          {processandoLogout ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
              <Text style={styles.logoutText}>Sair da Conta</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <Text style={styles.versao}>Odontologia Angola v1.0.0</Text>

      <Modal
        visible={showProvincias}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProvincias(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione a Provincia</Text>
              <TouchableOpacity onPress={() => setShowProvincias(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
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
            <ScrollView keyboardShouldPersistTaps="handled">
              {ESPECIALIDADES_DENTISTA.map((esp) => (
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
                      styles.provinciaItemText,
                      especialidade === esp && styles.provinciaItemTextActive,
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

      <Modal
        visible={showGeneros}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGeneros(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione o Gênero</Text>
              <TouchableOpacity onPress={() => setShowGeneros(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {['Masculino', 'Feminino', 'Outro'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.provinciaItem,
                    genero === item && styles.provinciaItemActive,
                  ]}
                  onPress={() => {
                    setGenero(item);
                    setShowGeneros(false);
                  }}
                >
                  <Text
                    style={[
                      styles.provinciaItemText,
                      genero === item && styles.provinciaItemTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {genero === item && (
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingVertical: SIZES.xl,
    paddingHorizontal: SIZES.md,
  },
  headerDentista: { backgroundColor: COLORS.secondary },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  avatarText: { fontSize: 28, fontWeight: 'bold', color: COLORS.textInverse },
  headerNome: { fontSize: SIZES.fontXl, fontWeight: 'bold', color: COLORS.textInverse },
  headerEmail: { fontSize: SIZES.fontMd, color: COLORS.textInverse, opacity: 0.8, marginTop: 2 },
  headerExtra: { fontSize: SIZES.fontSm, color: COLORS.textInverse, opacity: 0.9, marginTop: SIZES.xs },
  tipoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusFull,
    marginTop: SIZES.md,
  },
  tipoText: { marginLeft: SIZES.xs, color: COLORS.primary, fontWeight: '600' },
  tipoTextDentista: { color: COLORS.secondary },
  section: { backgroundColor: COLORS.surface, marginTop: SIZES.md, padding: SIZES.md },
  savingBanner: {
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingBannerText: { marginLeft: SIZES.sm, color: COLORS.text, fontSize: SIZES.fontSm, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  sectionTitle: { fontSize: SIZES.fontLg, fontWeight: 'bold', color: COLORS.text },
  campo: { marginBottom: SIZES.md },
  campoLabel: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginBottom: 4 },
  campoValor: { fontSize: SIZES.fontMd, color: COLORS.text },
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
  selectText: { fontSize: SIZES.fontMd, color: COLORS.text },
  selectPlaceholder: { color: COLORS.textLight },
  editButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SIZES.md },
  editButton: { flex: 1, paddingVertical: SIZES.sm, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  cancelButton: {
    backgroundColor: COLORS.background,
    marginRight: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: { color: COLORS.textSecondary, fontWeight: '600' },
  saveButton: { backgroundColor: COLORS.primary, marginLeft: SIZES.sm },
  saveButtonText: { color: COLORS.textInverse, fontWeight: 'bold' },
  buttonDisabled: { backgroundColor: COLORS.primaryLight },
  opcaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  opcaoText: { flex: 1, marginLeft: SIZES.md, fontSize: SIZES.fontMd, color: COLORS.text },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    padding: SIZES.md,
  },
  logoutText: { marginLeft: SIZES.sm, fontSize: SIZES.fontMd, fontWeight: '600', color: COLORS.danger },
  versao: { textAlign: 'center', color: COLORS.textLight, fontSize: SIZES.fontSm, marginTop: SIZES.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
  modalTitle: { fontSize: SIZES.fontLg, fontWeight: 'bold', color: COLORS.text },
  provinciaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  provinciaItemActive: { backgroundColor: COLORS.backgroundSecondary },
  provinciaItemText: { fontSize: SIZES.fontMd, color: COLORS.text },
  provinciaItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
});

export default PerfilScreen;
