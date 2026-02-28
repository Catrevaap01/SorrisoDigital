import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { gerarRelatorioGeral } from '../../services/relatorioService';
import {
  exportarRelatorioDentistaPdf,
  exportarRelatorioGeralPdf,
} from '../../services/pdfReportService';

interface ReportStats {
  totalDentistas: number;
  totalPacientes: number;
  totalConsultas: number;
  totalMensagens: number;
  dentistasMesAtual: number;
  pacientesMesAtual: number;
}

interface DentistaResumo {
  id: string;
  nome: string;
  especialidade?: string;
  totalTriagens: number;
  triagensRespondidas: number;
}

const AdminReportsScreen: React.FC = () => {
  const [stats, setStats] = useState<ReportStats>({
    totalDentistas: 0,
    totalPacientes: 0,
    totalConsultas: 0,
    totalMensagens: 0,
    dentistasMesAtual: 0,
    pacientesMesAtual: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [dentistasResumo, setDentistasResumo] = useState<DentistaResumo[]>([]);

  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      const { count: dentistasCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'dentista');

      const { count: pacientesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'paciente');

      const { count: mensagensCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact' });

      const { count: consultasCount } = await supabase
        .from('agendamentos')
        .select('*', { count: 'exact' });

      const dataAgora = new Date();
      const inicioMes = new Date(dataAgora.getFullYear(), dataAgora.getMonth(), 1).toISOString();

      const { count: dentistasMes } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'dentista')
        .gte('created_at', inicioMes);

      const { count: pacientesMes } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'paciente')
        .gte('created_at', inicioMes);

      setStats({
        totalDentistas: dentistasCount || 0,
        totalPacientes: pacientesCount || 0,
        totalConsultas: consultasCount || 0,
        totalMensagens: mensagensCount || 0,
        dentistasMesAtual: dentistasMes || 0,
        pacientesMesAtual: pacientesMes || 0,
      });

      const relatorio = await gerarRelatorioGeral();
      if (relatorio.success && relatorio.data) {
        setDentistasResumo(
          relatorio.data.dentistas.map((d) => ({
            id: d.dentista.id,
            nome: d.dentista.nome || 'Dentista',
            especialidade: d.dentista.especialidade,
            totalTriagens: d.totalTriagens,
            triagensRespondidas: d.triagensRespondidas,
          }))
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Erro ao carregar estatisticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarEstatisticas();
    }, [])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarEstatisticas();
    setRefreshing(false);
  };

  const handleExportarGeral = async () => {
    setLoadingPdf('geral');
    const result = await exportarRelatorioGeralPdf();
    setLoadingPdf(null);
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao exportar PDF',
        text2: result.error || 'Falha ao gerar relatorio geral',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'PDF gerado',
      text2: 'Relatorio geral pronto para compartilhar/imprimir',
    });
  };

  const handleExportarDentista = async (dentistaId: string) => {
    setLoadingPdf(dentistaId);
    const result = await exportarRelatorioDentistaPdf(dentistaId);
    setLoadingPdf(null);
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao exportar PDF',
        text2: result.error || 'Falha ao gerar relatorio do dentista',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'PDF gerado',
      text2: 'Relatorio do dentista pronto para compartilhar/imprimir',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.danger} />
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Relatorios do Sistema</Text>
          </View>

          <View style={styles.statsContainer}>
            <StatCard icon="person-circle" label="Total de Dentistas" valor={stats.totalDentistas} cor={COLORS.secondary} />
            <StatCard icon="people" label="Total de Pacientes" valor={stats.totalPacientes} cor={COLORS.primary} />
            <StatCard icon="mail" label="Total de Mensagens" valor={stats.totalMensagens} cor={COLORS.info} />
            <StatCard icon="calendar" label="Consultas" valor={stats.totalConsultas} cor={COLORS.warning} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do Mes Atual</Text>
            <View style={styles.resumoCard}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Dentistas cadastrados</Text>
                <Text style={styles.resumoValue}>{stats.dentistasMesAtual}</Text>
              </View>
              <View style={styles.resumoDivider} />
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Pacientes cadastrados</Text>
                <Text style={styles.resumoValue}>{stats.pacientesMesAtual}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exportacao de Relatorios (PDF)</Text>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={handleExportarGeral}
              disabled={loadingPdf === 'geral'}
            >
              {loadingPdf === 'geral' ? (
                <ActivityIndicator color={COLORS.textInverse} />
              ) : (
                <>
                  <Ionicons name="print" size={18} color={COLORS.textInverse} />
                  <Text style={styles.exportButtonText}>Imprimir/Compartilhar Relatorio Geral</Text>
                </>
              )}
            </TouchableOpacity>

            {dentistasResumo.map((d) => (
              <View style={styles.dentistaRow} key={d.id}>
                <View style={styles.dentistaInfo}>
                  <Text style={styles.dentistaNome}>{d.nome}</Text>
                  <Text style={styles.dentistaMeta}>
                    {d.especialidade || 'Sem especialidade'} | {d.triagensRespondidas}/{d.totalTriagens} respondidas
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.dentistaPdfButton}
                  onPress={() => handleExportarDentista(d.id)}
                  disabled={loadingPdf === d.id}
                >
                  {loadingPdf === d.id ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ultimas estatisticas carregadas automaticamente</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
};

interface StatCardProps {
  icon: string;
  label: string;
  valor: number;
  cor: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, valor, cor }) => (
  <TouchableOpacity style={[styles.statCard, { borderLeftColor: cor }]}> 
    <View style={styles.statContent}>
      <Ionicons name={icon as any} size={32} color={cor} />
      <View style={styles.statText}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, { color: cor }]}>{valor}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  header: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: TYPOGRAPHY.sizes.xl, fontWeight: '700', color: COLORS.text },
  statsContainer: { padding: SPACING.md, gap: SPACING.sm },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statContent: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  statText: { flex: 1 },
  statLabel: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  statValue: { fontSize: TYPOGRAPHY.sizes.lg, fontWeight: '700' },
  section: { padding: SPACING.md },
  sectionTitle: { fontSize: TYPOGRAPHY.sizes.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  resumoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  resumoDivider: { height: 1, backgroundColor: COLORS.border },
  resumoLabel: { fontSize: TYPOGRAPHY.sizes.md, color: COLORS.text },
  resumoValue: { fontSize: TYPOGRAPHY.sizes.md, fontWeight: '700', color: COLORS.primary },
  footer: { padding: SPACING.md, alignItems: 'center' },
  footerText: { fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary },
  exportButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  exportButtonText: { color: COLORS.textInverse, fontSize: TYPOGRAPHY.sizes.sm, fontWeight: '700' },
  dentistaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  dentistaInfo: { flex: 1, marginRight: SPACING.md },
  dentistaNome: { fontSize: TYPOGRAPHY.sizes.md, color: COLORS.text, fontWeight: '600' },
  dentistaMeta: { marginTop: 2, fontSize: TYPOGRAPHY.sizes.xs, color: COLORS.textSecondary },
  dentistaPdfButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});

export default AdminReportsScreen;
