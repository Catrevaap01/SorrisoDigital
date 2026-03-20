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
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { gerarRelatorioGeral } from '../../services/relatorioService';
import {
  exportarRelatorioDentistaPdf,
  exportarRelatorioGeralPdf,
} from '../../services/pdfReportService';

interface ReportStats {
  totalCadastros: number;
  totalDentistas: number;
  totalPacientes: number;
  totalConsultas: number;
  totalMensagens: number;
  cadastrosMesAtual: number;
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

interface AdminReportStatsRpc {
  total_cadastros: number;
  total_dentistas: number;
  total_pacientes: number;
  total_consultas: number;
  total_mensagens: number;
  cadastros_mes_atual?: number;
  dentistas_mes_atual?: number;
  pacientes_mes_atual?: number;
}

const normalizeTipo = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const buildMonthlyStats = (profiles: any[]) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const profilesThisMonth = profiles.filter((p: any) => {
    const createdAt = p?.created_at ? new Date(p.created_at) : null;
    return !!createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= monthStart;
  });

  const pacientesMes = profilesThisMonth.filter(
    (p: any) => normalizeTipo(p?.tipo) === 'paciente'
  ).length;
  const dentistasMes = profilesThisMonth.filter((p: any) => {
    const tipo = normalizeTipo(p?.tipo);
    return tipo === 'dentista' || tipo === 'medico';
  }).length;

  return {
    cadastrosMesAtual: pacientesMes + dentistasMes,
    dentistasMesAtual: dentistasMes,
    pacientesMesAtual: pacientesMes,
  };
};

const AdminReportsScreen: React.FC = () => {
  const [stats, setStats] = useState<ReportStats>({
    totalCadastros: 0,
    totalDentistas: 0,
    totalPacientes: 0,
    totalConsultas: 0,
    totalMensagens: 0,
    cadastrosMesAtual: 0,
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
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_report_stats');
      let usedRpc = false;

      if (!rpcError && rpcData) {
        const row: AdminReportStatsRpc = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row) {
          let monthStats = {
            cadastrosMesAtual: Number(row.cadastros_mes_atual || 0),
            dentistasMesAtual: Number(row.dentistas_mes_atual || 0),
            pacientesMesAtual: Number(row.pacientes_mes_atual || 0),
          };

          if (
            row.cadastros_mes_atual === undefined ||
            row.dentistas_mes_atual === undefined ||
            row.pacientes_mes_atual === undefined
          ) {
            const { data: perfisMesBase, error: perfisMesError } = await supabase
              .from('profiles')
              .select('tipo, created_at');

            if (!perfisMesError && perfisMesBase) {
              monthStats = buildMonthlyStats(perfisMesBase);
            }
          }

            const totalCadastros = Number(row.total_cadastros || 0);
            const totalDentistas = Number(row.total_dentistas || 0);
            const totalPacientes = Number(row.total_pacientes || 0);
            setStats({
              totalCadastros,
              totalDentistas,
              totalPacientes,
              totalConsultas: Number(row.total_consultas || 0),
              totalMensagens: Number(row.total_mensagens || 0),
              cadastrosMesAtual: totalCadastros,
              dentistasMesAtual: monthStats.dentistasMesAtual,
              pacientesMesAtual: monthStats.pacientesMesAtual,
            });
          usedRpc = true;
        }
      }

      if (!usedRpc) {
        const [
          { data: perfis, error: perfisError },
          { data: mensagens, error: mensagensError },
          { data: consultas, error: consultasError },
        ] = await Promise.all([
          supabase.from('profiles').select('id, tipo, created_at'),
          supabase.from('messages').select('id'),
          supabase.from('agendamentos').select('id'),
        ]);

      if (perfisError) throw perfisError;
      if (mensagensError) throw mensagensError;
      if (consultasError) throw consultasError;

      const perfisList = perfis || [];
      const totalPacientes = perfisList.filter((p: any) => normalizeTipo(p?.tipo) === 'paciente').length;
      const totalDentistas = perfisList.filter((p: any) => {
        const tipo = normalizeTipo(p?.tipo);
        return tipo === 'dentista' || tipo === 'medico';
      }).length;
      const totalCadastros = totalDentistas + totalPacientes;
      const monthStats = buildMonthlyStats(perfisList);

      setStats({
        totalCadastros,
        totalDentistas,
        totalPacientes,
        totalConsultas: (consultas || []).length,
        totalMensagens: (mensagens || []).length,
        cadastrosMesAtual: totalCadastros,
        dentistasMesAtual: monthStats.dentistasMesAtual,
        pacientesMesAtual: monthStats.pacientesMesAtual,
      });
      }

      void gerarRelatorioGeral().then((relatorio) => {
        if (!relatorio.success || !relatorio.data) return;
        setDentistasResumo(
          relatorio.data.dentistas.map((d) => ({
            id: d.dentista.id,
            nome: d.dentista.nome || 'Dentista',
            especialidade: d.dentista.especialidade,
            totalTriagens: d.totalTriagens,
            triagensRespondidas: d.triagensRespondidas,
          }))
        );
      }).catch(() => {});
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar estatisticas',
        text2: 'Verifique as politicas RLS',
      });
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
      text2: 'Relatorio geral pronto',
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
      text2: 'Relatorio do dentista pronto',
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
            <Text style={styles.headerTitle}>Relatórios do Sistema</Text>
          </View>

          <View style={styles.statsContainer}>
            <StatCard icon="people-circle" label="Total Geral" valor={stats.totalCadastros} cor={COLORS.danger} />
            <StatCard icon="person-circle" label="Total de Dentistas" valor={stats.totalDentistas} cor={COLORS.secondary} />
            <StatCard icon="people" label="Total de Pacientes" valor={stats.totalPacientes} cor={COLORS.primary} />
            <StatCard icon="mail" label="Total de Mensagens" valor={stats.totalMensagens} cor={COLORS.info} />
            <StatCard icon="calendar" label="Consultas" valor={stats.totalConsultas} cor={COLORS.warning} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do Mês Atual</Text>
            <View style={styles.resumoCard}>
              <View style={styles.resumoRow}>
                <Text style={styles.resumoLabel}>Total do mês </Text>
                <Text style={styles.resumoValue}>{stats.cadastrosMesAtual}</Text>
              </View>
              <View style={styles.resumoDivider} />
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
            <Text style={styles.sectionTitle}>Exportação de Relatórios (PDF)</Text>
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
                  <Text style={styles.exportButtonText}>Imprimir Relatorio Geral</Text>
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
                    <>
                      <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.dentistaPdfButtonText}>Imprimir</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ultimas estatísticas carregadas automaticamente</Text>
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
  headerSubtitle: { marginTop: SPACING.xs, fontSize: TYPOGRAPHY.sizes.sm, color: COLORS.textSecondary },
  statsContainer: { padding: SPACING.md, gap: SPACING.sm },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
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
    ...SHADOWS.sm,
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
    minHeight: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  dentistaPdfButtonText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
  },
});

export default AdminReportsScreen;
