import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import QRCode from 'react-native-qrcode-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { exportHtmlAsPdf } from '../../utils/pdfExportUtils';
import Toast from 'react-native-toast-message';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DentistaStackParamList } from '../../navigation/types';
import { createPaciente, CriarPacienteData, calcularIdade } from '../../services/pacienteService';
import { gerarFichaCadastroHTML } from '../../services/fichaService';
import { COLORS, SHADOWS, SIZES } from '../../styles/theme';
import { formatBirthDateInput } from '../../utils/helpers';
import { PROVINCIAS_ANGOLA } from '../../utils/constants';

const APP_URL = Constants.expoConfig?.extra?.APP_URL || 'https://teodontoangola.vercel.app';

type Props = NativeStackScreenProps<DentistaStackParamList, 'CadastrarPaciente'>;

const EMPTY_FORM: CriarPacienteData = {
  nome: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  genero: undefined as any,
  provincia: '',
};

const NovoPacienteScreen: React.FC<Props> = ({ navigation: propNavigation }) => {
  const { profile: dentista } = useAuth();
  const navigation = propNavigation;

  const [formData, setFormData] = useState<CriarPacienteData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [showProvincias, setShowProvincias] = useState(false);
  const [previewFicha, setPreviewFicha] = useState(false);
  const [fichaHtml, setFichaHtml] = useState('');
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const validarFormulario = (): string | null => {
    if (!formData.nome.trim()) return 'Nome obrigatório';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Email inválido';
    if (!formData.provincia) return 'Província obrigatória';
    return null;
  };

  const handleInputChange = (field: keyof CriarPacienteData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'data_nascimento' ? formatBirthDateInput(value) : value,
    }));
  };

  const handleCreatePaciente = async () => {
    const erro = validarFormulario();
    if (erro) {
      Toast.show({ type: 'error', text1: 'Erro', text2: erro });
      return;
    }

    setLoading(true);
    try {
      const result = await createPaciente(dentista?.id || '', formData);
      if (!result.success || !result.data || !result.tempPassword) {
        Toast.show({ type: 'error', text1: 'Erro', text2: result.error || 'Falha ao criar paciente' });
        return;
      }

      const html = await gerarFichaCadastroHTML(
        result.data,
        result.tempEmail || formData.email, // ✅ Use normalized email from result
        result.tempPassword,
        dentista?.nome || 'Dentista'
      );

      setFichaHtml(html);
      // QR aponta para o login com auto-fill
      setQrCodeValue(`${APP_URL}/login?email=${encodeURIComponent(result.tempEmail || formData.email)}&password=${encodeURIComponent(result.tempPassword)}`);
      setCreatedCredentials({ email: result.tempEmail || formData.email, password: result.tempPassword });
      setPreviewFicha(true);

      Toast.show({ type: 'success', text1: '✅ Paciente criado com sucesso!', text2: 'Ficha pronta para impressão' });

      // NÃO faz navigation.goBack() - dentista permanece na tela
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro', text2: error.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const result = await exportHtmlAsPdf(fichaHtml, `ficha-${formData.nome.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Erro', text2: error.message || 'Falha ao gerar PDF' });
    }
  };

  const printPDF = async () => {
    // Na web, exportHtmlAsPdf já abre o diálogo de impressão
    // No mobile, ele abre o diálogo de compartilhamento que permite imprimir
    await downloadPDF();
  };

  const resetarFormulario = () => {
    setFormData({ ...EMPTY_FORM });
    setPreviewFicha(false);
    setFichaHtml('');
    setQrCodeValue('');
    setCreatedCredentials(null);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="person-add" size={32} color={COLORS.secondary} />
          </View>
          <Text style={styles.title}>Novo Paciente</Text>
          <Text style={styles.subtitle}>Dr(a). {dentista?.nome}</Text>
          {dentista?.especialidade && (
            <Text style={styles.specialty}>{dentista.especialidade}</Text>
          )}
        </View>

        <View style={styles.form}>
          <Input
            label="Nome Completo *"
            value={formData.nome}
            onChangeText={(v) => handleInputChange('nome', v)}
            icon="person"
          />
          <Input
            label="Email *"
            value={formData.email}
            onChangeText={(v) => handleInputChange('email', v)}
            keyboardType="email-address"
            icon="mail"
          />
          <Input
            label="Telefone"
            value={formData.telefone}
            onChangeText={(v) => handleInputChange('telefone', v)}
            keyboardType="phone-pad"
            icon="call"
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -10 }}>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' }}>Data Nascimento</Text>
            {formData.data_nascimento.length >= 10 && (
              <Text style={{ fontSize: 13, color: COLORS.secondary, fontWeight: 'bold' }}>
                {calcularIdade(formData.data_nascimento)} anos
              </Text>
            )}
          </View>
          <Input
            value={formData.data_nascimento}
            onChangeText={(v) => handleInputChange('data_nascimento', v)}
            keyboardType="numeric"
            icon="calendar"
            placeholder="AAAA-MM-DD"
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Gênero</Text>
              <View style={styles.radioRow}>
                {['Masculino', 'Feminino', 'Outro'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.radioBtn, formData.genero === g && styles.radioSelected]}
                    onPress={() => handleInputChange('genero' as any, g)}
                  >
                    <Text style={[styles.radioText, formData.genero === g && styles.radioTextSelected]}>
                      {g.charAt(0)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.half}>
              <TouchableOpacity style={styles.select} onPress={() => setShowProvincias(true)}>
                <Text style={styles.label}>Província *</Text>
                <Text style={[styles.selectText, !formData.provincia && styles.placeholder]}>
                  {formData.provincia || 'Selecionar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title={loading ? 'Criando...' : '👤 Cadastrar e Gerar QR Ficha'}
            onPress={handleCreatePaciente}
            loading={loading}
            style={styles.btn}
          />
        </View>
      </ScrollView>

      {/* Modal Províncias */}
      <Modal visible={showProvincias} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Províncias Angola</Text>
              <TouchableOpacity onPress={() => setShowProvincias(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.provList}>
              {PROVINCIAS_ANGOLA.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.provItem, formData.provincia === p && styles.provSelected]}
                  onPress={() => {
                    handleInputChange('provincia' as any, p);
                    setShowProvincias(false);
                  }}
                >
                  <Text style={styles.provText}>{p}</Text>
                  {formData.provincia === p && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Ficha Preview - Dentista permanece aqui */}
      <Modal visible={previewFicha} animationType="slide">
        <View style={styles.fichaOverlay}>
          <ScrollView style={styles.fichaContainer}>
            <View style={styles.fichaHeader}>
              <View>
                <Text style={styles.fichaTitle}>✅ Paciente Criado</Text>
                <Text style={styles.fichaSubtitle}>{formData.nome}</Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewFicha(false)}>
                <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Credenciais rápidas */}
            {createdCredentials && (
              <View style={styles.credBox}>
                <Text style={styles.credTitle}>🔑 Credenciais do Paciente</Text>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Email:</Text>
                  <Text style={styles.credValue}>{createdCredentials.email}</Text>
                </View>
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Senha:</Text>
                  <Text style={styles.credValue}>{createdCredentials.password}</Text>
                </View>
              </View>
            )}

            {/* QR Code para instalar PWA */}
            <View style={styles.qrSection}>
              <Text style={styles.qrTitle}>📲 QR - Instalar o App</Text>
              <Text style={styles.qrSubtitle}>Escaneie com a câmera do celular</Text>
              <View style={styles.qrWrapper}>
                {qrCodeValue ? (
                  <QRCode value={qrCodeValue} size={200} backgroundColor="white" />
                ) : (
                  <View style={styles.qrEmpty}>
                    <Text style={styles.qrEmptyText}>QR não disponível</Text>
                  </View>
                )}
              </View>
              <Text style={styles.qrUrl}>{qrCodeValue || 'URL do QR pendente'}</Text>
              <View style={styles.qrInstructionsBox}>
                <Text style={styles.qrInstructionsText}>1. Escaneie o QR Code com a câmera do celular</Text>
                <Text style={styles.qrInstructionsText}>2. No navegador, toque em "Instalar" ou "Adicionar à tela inicial"</Text>
                <Text style={styles.qrInstructionsText}>3. Abra o app e faça login com o email e senha desta ficha</Text>
                <Text style={styles.qrInstructionsText}>4. Altere a sua senha no menu Perfil para mais segurança</Text>
              </View>
            </View>

            {/* Ações */}
            <View style={styles.fichaActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={printPDF}>
                <Ionicons name="print" size={22} color="white" />
                <Text style={styles.actionText}>Imprimir Ficha</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.actionSecondary]} onPress={downloadPDF}>
                <Ionicons name="download" size={22} color={COLORS.primary} />
                <Text style={[styles.actionText, styles.actionTextSecondary]}>Baixar PDF</Text>
              </TouchableOpacity>
            </View>

            {/* Botão para criar outro paciente sem perder a sessão */}
            <TouchableOpacity style={styles.newPatientBtn} onPress={resetarFormulario}>
              <Ionicons name="add-circle" size={22} color={COLORS.secondary} />
              <Text style={styles.newPatientText}>Criar Outro Paciente</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={() => { setPreviewFicha(false); navigation.goBack(); }}>
              <Ionicons name="arrow-back" size={18} color={COLORS.textSecondary} />
              <Text style={styles.backText}>Voltar ao Painel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  headerBackBtn: {
    position: 'absolute',
    left: 0,
    top: 5,
    padding: 8,
    zIndex: 10,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.secondary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: 5 },
  specialty: { fontSize: 13, color: COLORS.primary, marginTop: 4, fontWeight: '600' },
  form: { gap: 15 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  label: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 5, fontWeight: '500' },
  radioRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  radioBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radioText: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  radioTextSelected: { color: 'white' },
  select: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  selectText: { fontSize: 16, color: COLORS.text },
  placeholder: { color: COLORS.textLight },
  btn: { marginTop: 20 },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  provList: { maxHeight: 400 },
  provItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  provSelected: { backgroundColor: '#e3f2fd' },
  provText: { fontSize: 16 },

  fichaOverlay: { flex: 1, backgroundColor: COLORS.background },
  fichaContainer: { flex: 1 },
  fichaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
  },
  fichaTitle: { color: 'white', fontSize: 22, fontWeight: 'bold' },
  fichaSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 2 },

  credBox: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  credTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark, marginBottom: 12 },
  credRow: { flexDirection: 'row', marginBottom: 8 },
  credLabel: { fontSize: 14, color: COLORS.textSecondary, width: 60 },
  credValue: { fontSize: 22, fontWeight: '700', color: '#000', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1 },
  qrInstructionsBox: { marginTop: 15, width: '100%', padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8 },
  qrInstructionsText: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4, lineHeight: 16 },
  qrEmpty: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 12,
  },
  qrEmptyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },

  qrSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    ...SHADOWS.md,
  },
  qrTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primaryDark },
  qrSubtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  qrUrl: { fontSize: 12, color: COLORS.primary, marginTop: 12, textAlign: 'center' },

  fichaActions: { flexDirection: 'row', gap: 12, padding: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    ...SHADOWS.sm,
  },
  actionSecondary: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  actionText: { color: 'white', fontSize: 15, fontWeight: '700' },
  actionTextSecondary: { color: COLORS.primary },

  newPatientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  newPatientText: { color: COLORS.secondary, fontSize: 16, fontWeight: '700' },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 40,
    paddingVertical: 14,
  },
  backText: { color: COLORS.textSecondary, fontSize: 14 },
});

export default NovoPacienteScreen;
