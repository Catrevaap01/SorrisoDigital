import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { buscarTodosAgendamentosDentista } from '../../services/agendamentoService';
import { buscarPaciente } from '../../services/pacienteService';
import Loading from '../../components/ui/Loading';
import { gerarFichaHistorico } from './gerarFichaHistorico';

interface PacienteListItem {
  id: string;
  nome: string;
}

const DentistaRelatorioScreen: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [showPacienteModal, setShowPacienteModal] = useState(false);
  const [pacientesList, setPacientesList] = useState<PacienteListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const result = await buscarTodosAgendamentosDentista(profile.id);
      if (!result.success) {
        const errMsg = result.error || 'Falha nos agendamentos';
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar',
          text2: errMsg
        });
        setError(errMsg);
        setAgendamentos([]);
        setPacientesList([]);
      } else {
        setAgendamentos(result.data || []);
        
        const uniquePacientes = Array.from(
          new Set((result.data || []).map((ag: any) => ag.paciente_id).filter(Boolean))
        );
        
        const pacientesList: PacienteListItem[] = [];
        for (const id of uniquePacientes) {
          try {
            const pResult = await buscarPaciente(id);
            if (pResult.success && pResult.data) {
              pacientesList.push({
                id, 
                nome: pResult.data.nome || `Paciente ID: ${id}`
              });
            } else {
              pacientesList.push({id, nome: `Paciente ID: ${id}`});
            }
          } catch (pErr) {
            console.warn('Paciente fetch error:', id, pErr);
            pacientesList.push({id, nome: `Paciente ID: ${id}`});
          }
        }
        setPacientesList(pacientesList.sort((a,b) => a.nome.localeCompare(b.nome)));
      }
    } catch (error: any) {
      const errMsg = 'Erro de conexão - Verifique sua internet';
      Toast.show({
        type: 'error',
        text1: 'Erro de conexão',
        text2: errMsg
      });
      setError(errMsg);
      setAgendamentos([]);
      setPacientesList([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [carregarDados]);

  const gerarPdfAgendamentos = async () => {
    setGerandoPdf(true);
    try {
      const totalConsultas = agendamentos.length;
      const consultasMes = agendamentos.filter((ag: any) => {
        const data = new Date(ag.data_agendamento);
        const agora = new Date();
        return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
      }).length;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Relatório de Consultas - Dr(a). ${profile?.nome || 'Dentista'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
            h1 { color: #1E88E5; text-align: center; }
            .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
            .stat-card { background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center; }
            .stat-number { font-size: 24px; font-weight: bold; color: #1E88E5; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background: #1E88E5; color: white; font-weight: bold; }
            tr:nth-child(even) { background: #f9f9f9; }
            @media print { body { margin: 0; padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>🦷 TeOdonto Angola - Relatório de Consultas</h1>
          <div class="info">
            <p><strong>Dentista:</strong> ${profile?.nome || 'N/D'}</p>
            <p><strong>Especialidade:</strong> ${profile?.especialidade || 'N/D'}</p>
            <p><strong>Total Consultas:</strong> ${totalConsultas}</p>
            <p><strong>Consultas este mês:</strong> ${consultasMes}</p>
            <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-AO')}</p>
          </div>
          <div class="stats">
            <div class="stat-card">
              <div class="stat-number">${totalConsultas}</div>
              <div>Total Consultas</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${consultasMes}</div>
              <div>Este Mês</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Data/Hora</th>
                <th>Status</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${agendamentos.slice(0, 50).map((ag: any) => `
                <tr>
                  <td>${ag.paciente?.nome || 'N/D'}</td>
                  <td>${new Date(ag.data_agendamento).toLocaleString('pt-AO')}</td>
                  <td>${ag.status || 'Pendente'}</td>
                  <td>${ag.tipo || 'Consulta'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${agendamentos.length > 50 ? '<p style="text-align:center; font-style:italic; color:#666;">... e mais ' + (agendamentos.length - 50) + ' registros</p>' : ''}
        </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Compartilhar relatório PDF',
        mimeType: 'application/pdf'
      });
      Toast.show({
        type: 'success',
        text1: '✅ Relatório gerado!',
        text2: 'PDF pronto para compartilhar'
      });
    } catch (error: any) {
      console.error('Erro PDF:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Erro ao gerar PDF',
        text2: error.message || 'Tente novamente'
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  const gerarFichaPaciente = async (pacienteId: string) => {
    setShowPacienteModal(false);
    setGerandoPdf(true);
    try {
      const html = await gerarFichaHistorico(pacienteId);
      
      const { uri } = await Print.printToFileAsync({ html });
      
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Compartilhar ficha PDF',
        mimeType: 'application/pdf'
      });
      Toast.show({
        type: 'success',
        text1: '✅ Ficha gerada!',
        text2: 'PDF pronto para compartilhar'
      });
    } catch (error: any) {
      console.error('Erro ficha:', error);
      Toast.show({
        type: 'error',
        text1: '❌ Erro ao gerar ficha',
        text2: error.message || 'Tente novamente'
      });
    } finally {
      setGerandoPdf(false);
    }
  };

  if (loading && !error) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        contentContainerStyle={styles.contentContainerStyle}
      >
        <View style={styles.header}>
          <Ionicons name="document-text" size={32} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Meus Relatórios</Text>
          <Text style={styles.headerSubtitle}>Consultas, fichas e estatísticas</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
            <Text style={styles.errorTitle}>Erro ao carregar relatórios</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh} activeOpacity={0.8}>
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {agendamentos.length === 0 && !loading && !error && (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>Nenhuma consulta encontrada</Text>
            <Text style={styles.emptyText}>Faça seu primeiro agendamento para gerar relatórios</Text>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{agendamentos.length}</Text>
            <Text style={styles.statLabel}>Total Consultas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pacientesList.length}</Text>
            <Text style={styles.statLabel}>Pacientes Únicos</Text>
          </View>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity 
            style={[styles.card, styles.cardElevated]}
            onPress={() => setShowPacienteModal(true)}
            activeOpacity={0.8}
            disabled={gerandoPdf}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="document-attach-outline" size={32} color="#9C27B0" />
            </View>
            <Text style={styles.cardTitle}>Ficha do Paciente</Text>
            <Text style={styles.cardDescription}>Gerar ficha completa com histórico e triagens</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cardFooterText}>{pacientesList.length} pacientes disponíveis</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, styles.cardElevated]}
            onPress={gerarPdfAgendamentos}
            activeOpacity={0.8}
            disabled={gerandoPdf}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>Relatório Completo</Text>
            <Text style={styles.cardDescription}>Resumo detalhado de todas as consultas</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              <Text style={styles.cardFooterText}>{agendamentos.length} registros</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {gerandoPdf && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingContent}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.generatingText}>Gerando PDF profissional...</Text>
            <Text style={styles.generatingSubtext}>Aguarde alguns segundos</Text>
          </View>
        </View>
      )}

      <Modal visible={showPacienteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Paciente</Text>
              <TouchableOpacity onPress={() => setShowPacienteModal(false)}>
                <Ionicons name="close-circle" size={28} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pacientesList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pacienteItem}
                  onPress={() => gerarFichaPaciente(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pacienteNome}>{item.nome}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              style={styles.pacientesList}
              showsVerticalScrollIndicator={false}
            />
            {pacientesList.length === 0 && (
              <View style={styles.emptyModal}>
            <Ionicons name="person-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyModalText}>Nenhum paciente nos agendamentos</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainerStyle: {
    paddingBottom: SIZES.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
    paddingVertical: SIZES.lg,
  },
  headerTitle: {
    fontSize: SIZES.fontXxl,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SIZES.sm,
  },
  headerSubtitle: {
    fontSize: SIZES.fontLg,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
    paddingHorizontal: SIZES.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: SIZES.xl,
    paddingHorizontal: SIZES.md,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    minWidth: 120,
    ...SHADOWS.md,
  },
  statNumber: {
    fontSize: SIZES.fontXxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  cardsContainer: {
    paddingHorizontal: SIZES.md,
    gap: SIZES.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    ...SHADOWS.md,
  },
  cardElevated: {
    ...SHADOWS.lg,
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  cardTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  cardDescription: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SIZES.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SIZES.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    marginTop: SIZES.sm,
  },
  cardFooterText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SIZES.xxl,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.lg,
    marginBottom: SIZES.sm,
  },
  emptyText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SIZES.lg,
  },
  errorContainer: {
    backgroundColor: COLORS.surface,
    margin: SIZES.lg,
    padding: SIZES.xl,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  errorTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.danger,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  errorText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SIZES.lg,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  retryButtonText: {
    color: 'white',
    fontSize: SIZES.fontMd,
    fontWeight: '600',
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  generatingContent: {
    backgroundColor: 'white',
    padding: SIZES.xl,
    borderRadius: 36,
    alignItems: 'center',
    gap: SIZES.lg,
    minWidth: 280,
  },
  generatingText: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  generatingSubtext: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '92%',
    maxHeight: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 36,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  pacientesList: {
    maxHeight: 400,
    paddingHorizontal: SIZES.sm,
  },
  pacienteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  pacienteNome: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    flex: 1,
  },
  emptyModal: {
    alignItems: 'center',
    paddingVertical: SIZES.xl,
  },
  emptyModalText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
    textAlign: 'center',
  },
});

export default DentistaRelatorioScreen;
