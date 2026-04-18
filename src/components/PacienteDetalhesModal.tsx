import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { supabase } from '../config/supabase';
import { formatRelativeTime } from '../utils/helpers';

interface PacienteDetalhesModalProps {
  visible: boolean;
  onClose: () => void;
  pacienteId: string;
  onVerHistorico?: (pacienteId: string, pacienteNome: string) => void;
  itemTipo?: 'triagem' | 'agendamento' | 'procedimento';
  itemData?: any;
}

const PacienteDetalhesModal: React.FC<PacienteDetalhesModalProps> = ({
  visible,
  onClose,
  pacienteId,
  onVerHistorico,
  itemTipo,
  itemData,
}) => {
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  useEffect(() => {
    if (visible && pacienteId) {
      void carregarPaciente();
    }
  }, [visible, pacienteId]);

  const carregarPaciente = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', pacienteId)
        .single();

      if (error) throw error;
      setPaciente(data);
    } catch (err) {
      console.error('Erro ao carregar detalhes do paciente:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderInfoItem = (label: string, value: string | number | undefined, icon: string) => (
    <View style={styles.infoItem}>
      <View style={styles.infoIconContainer}>
        <Ionicons name={icon as any} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Não informado'}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isMobile ? styles.containerMobile : styles.containerWeb]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Detalhes do Paciente</Text>
              <Text style={styles.headerSubtitle}>Informações completas para triagem</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Buscando informações...</Text>
              </View>
            ) : paciente ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Dados Pessoais</Text>
                  {renderInfoItem('Nome Completo', paciente.nome, 'person-outline')}
                  {renderInfoItem('Idade', paciente.idade ? `${paciente.idade} anos` : undefined, 'calendar-outline')}
                  {renderInfoItem('Gênero', paciente.genero, 'transgender-outline')}
                  {renderInfoItem('Telefone', paciente.telefone, 'call-outline')}
                  {renderInfoItem('Endereço/Província', paciente.provincia || paciente.endereco, 'location-outline')}
                </View>

                {itemData && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informações da Solicitação</Text>
                    {itemTipo === 'triagem' ? (
                      <>
                        {renderInfoItem('Sintoma Principal', itemData.sintoma_principal, 'medical-outline')}
                        {renderInfoItem('Descrição', itemData.descricao, 'document-text-outline')}
                        {renderInfoItem('Intensidade da Dor', itemData.intensidade_dor ? `${itemData.intensidade_dor}/10` : '0/10', 'flash-outline')}
                      </>
                    ) : (
                      <>
                        {renderInfoItem('Sintomas', itemData.symptoms, 'medical-outline')}
                        {renderInfoItem('Urgência', itemData.urgency, 'alert-circle-outline')}
                      </>
                    )}
                    {renderInfoItem('Solicitado em', formatRelativeTime(itemData.created_at), 'time-outline')}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Histórico Médico</Text>
                  <View style={styles.healthInfoContainer}>
                    <View style={styles.healthInfoItem}>
                      <Text style={styles.healthInfoLabel}>Alergias</Text>
                      <Text style={styles.healthInfoValue}>{paciente.alergias || 'Nenhuma informada'}</Text>
                    </View>
                    <View style={styles.healthInfoItem}>
                      <Text style={styles.healthInfoLabel}>Medicamentos</Text>
                      <Text style={styles.healthInfoValue}>{paciente.medicamentos_atuais || 'Nenhum informado'}</Text>
                    </View>
                  </View>
                </View>

                {onVerHistorico && (
                  <TouchableOpacity 
                    style={styles.historyBtn} 
                    onPress={() => {
                      onClose();
                      onVerHistorico(paciente.id, paciente.nome);
                    }}
                  >
                    <Ionicons name="time-outline" size={20} color="white" />
                    <Text style={styles.historyBtnText}>Ver Histórico Clínico Total</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
                <Text style={styles.errorText}>Não foi possível carregar os dados.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  containerWeb: {
    width: '100%',
    maxWidth: 550,
    maxHeight: '90%',
  },
  containerMobile: {
    width: '100%',
    maxHeight: '95%',
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingLeft: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  healthInfoContainer: {
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  healthInfoItem: {
    marginBottom: SPACING.sm,
  },
  healthInfoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BE123C',
    marginBottom: 4,
  },
  healthInfoValue: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  historyBtn: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  historyBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: '#64748B',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    marginTop: SPACING.md,
    color: COLORS.error,
    textAlign: 'center',
  },
});

export default PacienteDetalhesModal;
