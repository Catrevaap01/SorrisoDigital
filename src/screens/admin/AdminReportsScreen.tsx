/**
 * Tela de Relatórios do Admin
 * Visualizar estatísticas e relatórios do sistema
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';

interface ReportStats {
  totalDentistas: number;
  totalPacientes: number;
  totalConsultas: number;
  totalMensagens: number;
  dentistasMesAtual: number;
  pacientesMesAtual: number;
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

  // Carregar estatísticas
  const carregarEstatisticas = async () => {
    setLoading(true);
    try {
      // Contar dentistas
      const { count: dentistasCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'dentista');

      // Contar pacientes
      const { count: pacientesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'paciente');

      // Contar mensagens
      const { count: mensagensCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact' });

      // Dentistas criados este mês
      const dataAgora = new Date();
      const inicioMes = new Date(dataAgora.getFullYear(), dataAgora.getMonth(), 1).toISOString();
      const { count: dentistasMes } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'dentista')
        .gte('created_at', inicioMes);

      // Pacientes criados este mês
      const { count: pacientesMes } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('tipo', 'paciente')
        .gte('created_at', inicioMes);

      setStats({
        totalDentistas: dentistasCount || 0,
        totalPacientes: pacientesCount || 0,
        totalConsultas: 0, // TODO: Implementar contagem de consultas
        totalMensagens: mensagensCount || 0,
        dentistasMesAtual: dentistasMes || 0,
        pacientesMesAtual: pacientesMes || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
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

          {/* Cards de estatísticas */}
          <View style={styles.statsContainer}>
            <StatCard
              icon="person-circle"
              label="Total de Dentistas"
              valor={stats.totalDentistas}
              cor={COLORS.secondary}
            />
            <StatCard
              icon="people"
              label="Total de Pacientes"
              valor={stats.totalPacientes}
              cor={COLORS.primary}
            />
            <StatCard
              icon="mail"
              label="Total de Mensagens"
              valor={stats.totalMensagens}
              cor={COLORS.info}
            />
            <StatCard
              icon="calendar"
              label="Consultas"
              valor={stats.totalConsultas}
              cor={COLORS.warning}
            />
          </View>

          {/* Resumo mensal */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumo do Mês Atual</Text>
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

          {/* Botão de atualizar */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Últimas estatísticas carregadas automaticamente
            </Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statsContainer: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
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
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statText: {
    flex: 1,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
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
  resumoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  resumoLabel: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  resumoValue: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footer: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
  },
});

export default AdminReportsScreen;
