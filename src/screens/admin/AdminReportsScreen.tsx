/**
 * AdminReportsScreen — Central de Relatórios do Sistema
 * TeOdonto Angola — Painel Executivo e Exportação de Relatórios
 * 
 * Organizado em abas intuitivas:
 *  1. Visão Geral (Métricas, KPIs e Resumo do Mês)
 *  2. Dentistas (Desempenho e Exportação Individual)
 *  3. Secretários (Atividade Administrativa e Exportação)
 *  4. Central PDF (Exportação Rápida de Relatórios Oficiais)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { gerarRelatorioGeral } from '../../services/relatorioService';
import {
  exportarRelatorioDentistaPdf,
  exportarRelatorioGeralPdf,
  exportarRelatorioSecretarioPdf,
} from '../../services/pdfReportService';

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface ReportStats {
  totalCadastros: number;
  totalDentistas: number;
  totalPacientes: number;
  totalConsultas: number;
  totalMensagens: number;
  totalSecretarios: number;
  totalTriagens: number;
  triagensRespondidas: number;
  percentualResposta: number;
  receitaEstimada: number;
  receitaRealizada: number;
  cadastrosMesAtual: number;
  dentistasMesAtual: number;
  pacientesMesAtual: number;
  secretariosMesAtual: number;
}

interface DentistaResumo {
  id: string;
  nome: string;
  especialidade?: string;
  totalTriagens: number;
  triagensRespondidas: number;
}

interface SecretarioResumo {
  id: string;
  nome: string;
  email: string;
}

type TabSecao = 'geral' | 'dentistas' | 'secretarios' | 'pdf';

// ─── Componente Principal ──────────────────────────────────────────────────

const AdminReportsScreen: React.FC = () => {
  const [tabAtiva, setTabAtiva] = useState<TabSecao>('geral');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  const [buscaDentista, setBuscaDentista] = useState('');
  const [buscaSecretario, setBuscaSecretario] = useState('');

  const [stats, setStats] = useState<ReportStats>({
    totalCadastros: 0,
    totalDentistas: 0,
    totalPacientes: 0,
    totalConsultas: 0,
    totalMensagens: 0,
    totalSecretarios: 0,
    totalTriagens: 0,
    triagensRespondidas: 0,
    percentualResposta: 0,
    receitaEstimada: 0,
    receitaRealizada: 0,
    cadastrosMesAtual: 0,
    dentistasMesAtual: 0,
    pacientesMesAtual: 0,
    secretariosMesAtual: 0,
  });

  const [dentistasResumo, setDentistasResumo] = useState<DentistaResumo[]>([]);
  const [secretariosResumo, setSecretariosResumo] = useState<SecretarioResumo[]>([]);

  // ── Carregamento de Estatísticas ──
  const carregarEstatisticas = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gerarRelatorioGeral();

      if (result.success && result.data) {
        const d = result.data;
        const totalGeral = d.totalDentistas + d.totalPacientes + (d.totalSecretarios || 0);

        const dentistasMes = d.dentistasMes || 0;
        const pacientesMes = d.pacientesMes || 0;
        const secretariosMes = d.secretariosMes || 0;
        const totalMes = dentistasMes + pacientesMes + secretariosMes;

        setStats({
          totalCadastros: totalGeral,
          totalDentistas: d.totalDentistas || 0,
          totalPacientes: d.totalPacientes || 0,
          totalSecretarios: d.totalSecretarios || 0,
          totalConsultas: d.totalConsultas || 0,
          totalMensagens: d.totalMensagens || 0,
          totalTriagens: d.totalTriagens || 0,
          triagensRespondidas: d.triagensRespondidas || 0,
          percentualResposta: d.percentualResposta || 0,
          receitaEstimada: d.receitaEstimada || 0,
          receitaRealizada: d.receitaRealizada || 0,
          cadastrosMesAtual: totalMes,
          dentistasMesAtual: dentistasMes,
          pacientesMesAtual: pacientesMes,
          secretariosMesAtual: secretariosMes,
        });

        setDentistasResumo(
          (d.dentistas || []).map((dr: any) => ({
            id: dr.dentista.id,
            nome: dr.dentista.nome || 'Dentista',
            especialidade: dr.dentista.especialidade,
            totalTriagens: dr.totalTriagens || 0,
            triagensRespondidas: dr.triagensRespondidas || 0,
          }))
        );

        setSecretariosResumo(
          (d.secretarios || []).map((sec: any) => ({
            id: sec.id,
            nome: sec.nome || 'Secretário',
            email: sec.email || '',
          }))
        );
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro ao carregar relatórios',
          text2: result.error || 'Falha ao processar dados',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro inesperado',
        text2: error.message || 'Falha na conexão',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregarEstatisticas();
    }, [carregarEstatisticas])
  );

  useRealtimeRefresh({
    enabled: true,
    debounceMs: 1500,
    shouldRefresh: (event) =>
      event.table === 'profiles' ||
      event.table === 'appointments' ||
      event.table === 'triagens' ||
      event.table === 'messages' ||
      event.table === 'procedimentos_tratamento',
    refresh: () => {
      void carregarEstatisticas();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarEstatisticas();
    setRefreshing(false);
  };

  // ── Ações de Exportação PDF ──
  const handleExportarGeral = async () => {
    setLoadingPdf('geral');
    const result = await exportarRelatorioGeralPdf();
    setLoadingPdf(null);
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao exportar PDF',
        text2: result.error || 'Falha ao gerar relatório geral',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'PDF Gerado com Sucesso',
      text2: 'O relatório geral está pronto para visualização/impressão.',
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
        text2: result.error || 'Falha ao gerar relatório do dentista',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'PDF do Dentista Gerado',
      text2: 'Relatório individual gerado com sucesso.',
    });
  };

  const handleExportarSecretario = async (secretarioId: string) => {
    setLoadingPdf(secretarioId);
    const result = await exportarRelatorioSecretarioPdf(secretarioId);
    setLoadingPdf(null);
    if (!result.success) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao exportar PDF',
        text2: result.error || 'Falha ao gerar relatório do secretário',
      });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'PDF do Secretário Gerado',
      text2: 'Relatório administrativo gerado com sucesso.',
    });
  };

  // ── Listas Filtradas ──
  const dentistasFiltrados = useMemo(() => {
    const q = buscaDentista.trim().toLowerCase();
    if (!q) return dentistasResumo;
    return dentistasResumo.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        (d.especialidade && d.especialidade.toLowerCase().includes(q))
    );
  }, [dentistasResumo, buscaDentista]);

  const secretariosFiltrados = useMemo(() => {
    const q = buscaSecretario.trim().toLowerCase();
    if (!q) return secretariosResumo;
    return secretariosResumo.filter(
      (s) => s.nome.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  }, [secretariosResumo, buscaSecretario]);

  // Formatação de Dinheiro em Kwanzas
  const formatKz = (valor: number) =>
    Number(valor || 0)
      .toLocaleString('pt-AO', { minimumFractionDigits: 0 })
      .replace(/,/g, '.') + ' Kz';

  return (
    <View style={styles.container}>
      {/* ─── Cabeçalho Superior Alinhado ─── */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Relatórios do Sistema</Text>
            <Text style={styles.headerSubtitle}>
              Métricas executivas, produção clínica e exportação em PDF
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing || loading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar dados"
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Seletor de Abas Principais ─── */}
      <View style={styles.navBar}>
        <View style={styles.navBarInner}>
          <TouchableOpacity
            style={[styles.navTab, tabAtiva === 'geral' && styles.navTabActive]}
            onPress={() => setTabAtiva('geral')}
          >
            <Ionicons
              name="analytics-outline"
              size={17}
              color={tabAtiva === 'geral' ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.navTabText, tabAtiva === 'geral' && styles.navTabTextActive]}>
              Visão Geral
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, tabAtiva === 'dentistas' && styles.navTabActive]}
            onPress={() => setTabAtiva('dentistas')}
          >
            <Ionicons
              name="medkit-outline"
              size={17}
              color={tabAtiva === 'dentistas' ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.navTabText, tabAtiva === 'dentistas' && styles.navTabTextActive]}>
              Dentistas ({dentistasResumo.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, tabAtiva === 'secretarios' && styles.navTabActive]}
            onPress={() => setTabAtiva('secretarios')}
          >
            <Ionicons
              name="briefcase-outline"
              size={17}
              color={tabAtiva === 'secretarios' ? COLORS.primary : '#64748B'}
            />
            <Text
              style={[styles.navTabText, tabAtiva === 'secretarios' && styles.navTabTextActive]}
            >
              Secretários ({secretariosResumo.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, tabAtiva === 'pdf' && styles.navTabActive]}
            onPress={() => setTabAtiva('pdf')}
          >
            <Ionicons
              name="document-text-outline"
              size={17}
              color={tabAtiva === 'pdf' ? COLORS.primary : '#64748B'}
            />
            <Text style={[styles.navTabText, tabAtiva === 'pdf' && styles.navTabTextActive]}>
              PDFs
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Conteúdo das Abas ─── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>A processar estatísticas do sistema...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ABA 1: VISÃO GERAL (KPIs e Métricas)                         */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {tabAtiva === 'geral' && (
            <View style={styles.sectionWrap}>
              {/* Banner Rápido de PDF Geral */}
              <View style={styles.bannerPdf}>
                <View style={styles.bannerPdfContent}>
                  <View style={styles.bannerIconCircle}>
                    <Ionicons name="document-text" size={26} color="#1E88E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bannerPdfTitle}>Relatório Geral Consolidado</Text>
                    <Text style={styles.bannerPdfSubtitle}>
                      Gere o relatório completo em PDF pronto para auditoria e arquivo.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.bannerPdfBtn}
                  onPress={handleExportarGeral}
                  disabled={loadingPdf === 'geral'}
                >
                  {loadingPdf === 'geral' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="print-outline" size={18} color="#fff" />
                      <Text style={styles.bannerPdfBtnText}>Exportar PDF Geral</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Grid de Cartões de Métricas Principais */}
              <Text style={styles.groupHeader}>Indicadores de Comunidade & Cadastros</Text>
              <View style={styles.statsGrid}>
                <KpiCard
                  icon="people"
                  cor="#1E88E5"
                  titulo="Total de Utilizadores"
                  valor={stats.totalCadastros}
                  detalhes={`${stats.totalPacientes} Pacientes · ${stats.totalDentistas} Dentistas · ${stats.totalSecretarios} Secretários`}
                />
                <KpiCard
                  icon="medical"
                  cor="#059669"
                  titulo="Corpo Clínico (Dentistas)"
                  valor={stats.totalDentistas}
                  detalhes="Dentistas credenciados no sistema"
                />
                <KpiCard
                  icon="person"
                  cor="#D97706"
                  titulo="Pacientes Registados"
                  valor={stats.totalPacientes}
                  detalhes="Contas activas de pacientes"
                />
                <KpiCard
                  icon="briefcase"
                  cor="#7C3AED"
                  titulo="Secretários / Recepção"
                  valor={stats.totalSecretarios}
                  detalhes="Operadores de triagem e agenda"
                />
              </View>

              <Text style={[styles.groupHeader, { marginTop: 18 }]}>Atendimento & Triagens</Text>
              <View style={styles.statsGrid}>
                <KpiCard
                  icon="calendar"
                  cor="#2563EB"
                  titulo="Consultas Registadas"
                  valor={stats.totalConsultas}
                  detalhes="Agendamentos realizados"
                />
                <KpiCard
                  icon="chatbubbles"
                  cor="#0891B2"
                  titulo="Mensagens Trocadas"
                  valor={stats.totalMensagens}
                  detalhes="Interações na plataforma"
                />
                <KpiCard
                  icon="fitness"
                  cor="#DC2626"
                  titulo="Triagens Realizadas"
                  valor={stats.totalTriagens}
                  detalhes={`${stats.triagensRespondidas} respondidas (${stats.percentualResposta}%)`}
                />
                <KpiCard
                  icon="wallet"
                  cor="#16A34A"
                  titulo="Receita Realizada"
                  valor={formatKz(stats.receitaRealizada)}
                  detalhes={`Estimada: ${formatKz(stats.receitaEstimada)}`}
                  isStringValue
                />
              </View>

              {/* Card Resumo do Mês Atual */}
              <View style={styles.monthlyCard}>
                <View style={styles.monthlyHeader}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.monthlyTitle}>Crescimento no Mês Atual</Text>
                </View>

                <View style={styles.monthlyRow}>
                  <Text style={styles.monthlyLabel}>Total de Novos Cadastros</Text>
                  <Text style={styles.monthlyValueBold}>{stats.cadastrosMesAtual}</Text>
                </View>
                <View style={styles.dividerLine} />

                <View style={styles.monthlyRow}>
                  <Text style={styles.monthlyLabel}>Novos Dentistas</Text>
                  <Text style={styles.monthlyValue}>{stats.dentistasMesAtual}</Text>
                </View>
                <View style={styles.dividerLine} />

                <View style={styles.monthlyRow}>
                  <Text style={styles.monthlyLabel}>Novos Pacientes</Text>
                  <Text style={styles.monthlyValue}>{stats.pacientesMesAtual}</Text>
                </View>
                <View style={styles.dividerLine} />

                <View style={styles.monthlyRow}>
                  <Text style={styles.monthlyLabel}>Novos Secretários</Text>
                  <Text style={styles.monthlyValue}>{stats.secretariosMesAtual}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ABA 2: DENTISTAS (Desempenho e Exportação)                   */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {tabAtiva === 'dentistas' && (
            <View style={styles.sectionWrap}>
              {/* Caixa de Busca */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar dentista por nome ou especialidade..."
                  value={buscaDentista}
                  onChangeText={setBuscaDentista}
                  placeholderTextColor="#94A3B8"
                />
                {buscaDentista ? (
                  <TouchableOpacity onPress={() => setBuscaDentista('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {dentistasFiltrados.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="medkit-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Nenhum dentista encontrado</Text>
                  <Text style={styles.emptySubtitle}>Tente outro termo na pesquisa.</Text>
                </View>
              ) : (
                dentistasFiltrados.map((d) => (
                  <View style={styles.personCard} key={d.id}>
                    <View style={styles.personAvatar}>
                      <Text style={styles.personAvatarText}>
                        {d.nome.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.personBody}>
                      <Text style={styles.personName}>{d.nome}</Text>
                      <View style={styles.personTagsRow}>
                        <View style={styles.specialtyTag}>
                          <Text style={styles.specialtyTagText}>
                            {d.especialidade || 'Clínica Geral'}
                          </Text>
                        </View>
                        <Text style={styles.triagensCountText}>
                          {d.triagensRespondidas}/{d.totalTriagens} triagens
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.pdfActionBtn}
                      onPress={() => handleExportarDentista(d.id)}
                      disabled={loadingPdf === d.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Gerar PDF de ${d.nome}`}
                    >
                      {loadingPdf === d.id ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                          <Text style={styles.pdfActionBtnText}>PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ABA 3: SECRETÁRIOS (Atividade e Exportação)                  */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {tabAtiva === 'secretarios' && (
            <View style={styles.sectionWrap}>
              {/* Caixa de Busca */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Pesquisar secretário por nome ou email..."
                  value={buscaSecretario}
                  onChangeText={setBuscaSecretario}
                  placeholderTextColor="#94A3B8"
                />
                {buscaSecretario ? (
                  <TouchableOpacity onPress={() => setBuscaSecretario('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {secretariosFiltrados.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="briefcase-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>Nenhum secretário encontrado</Text>
                  <Text style={styles.emptySubtitle}>Tente outro termo na pesquisa.</Text>
                </View>
              ) : (
                secretariosFiltrados.map((s) => (
                  <View style={styles.personCard} key={s.id}>
                    <View style={[styles.personAvatar, { backgroundColor: '#EDE9FE' }]}>
                      <Text style={[styles.personAvatarText, { color: '#7C3AED' }]}>
                        {s.nome.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.personBody}>
                      <Text style={styles.personName}>{s.nome}</Text>
                      <Text style={styles.personEmail}>{s.email || 'Email não disponível'}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.pdfActionBtn}
                      onPress={() => handleExportarSecretario(s.id)}
                      disabled={loadingPdf === s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Gerar PDF de ${s.nome}`}
                    >
                      {loadingPdf === s.id ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <>
                          <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                          <Text style={styles.pdfActionBtnText}>PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ABA 4: CENTRAL DE EXPORTAÇÃO PDF                             */}
          {/* ═════════════════════════════════════════════════════════════ */}
          {tabAtiva === 'pdf' && (
            <View style={styles.sectionWrap}>
              <Text style={styles.groupHeader}>Documentos e Relatórios Prontos</Text>

              {/* Cartão PDF Geral */}
              <View style={styles.docCard}>
                <View style={[styles.docIconWrap, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="clipboard-outline" size={26} color="#1E88E5" />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>Relatório Geral da Clínica</Text>
                  <Text style={styles.docDesc}>
                    Visão completa dos indicadores de gestão, pacientes, profissionais e finanças.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.docBtn, { backgroundColor: '#1E88E5' }]}
                  onPress={handleExportarGeral}
                  disabled={loadingPdf === 'geral'}
                >
                  {loadingPdf === 'geral' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={16} color="#fff" />
                      <Text style={styles.docBtnText}>Gerar PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Informação sobre relatórios individuais */}
              <View style={styles.tipCard}>
                <Ionicons name="information-circle-outline" size={22} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipTitle}>Relatórios Individuais</Text>
                  <Text style={styles.tipText}>
                    Para gerar relatórios específicos de um dentista ou secretário, aceda às abas
                    "Dentistas" ou "Secretários" e clique no botão PDF ao lado do nome do
                    profissional.
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              TeOdonto Angola — Sistema Digital de Gestão Odontológica
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// ─── Sub-Componente de Cartão KPI ──────────────────────────────────────────

interface KpiCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  cor: string;
  titulo: string;
  valor: number | string;
  detalhes: string;
  isStringValue?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  icon,
  cor,
  titulo,
  valor,
  detalhes,
  isStringValue,
}) => {
  const displayVal = isStringValue
    ? String(valor)
    : Number(valor).toLocaleString('pt-AO');

  return (
    <View style={[styles.kpiCard, { borderLeftColor: cor }]}>
      <View style={styles.kpiHeaderRow}>
        <View style={[styles.kpiIconBox, { backgroundColor: cor + '15' }]}>
          <Ionicons name={icon} size={20} color={cor} />
        </View>
        <Text style={[styles.kpiValue, { color: cor }]} numberOfLines={1}>
          {displayVal}
        </Text>
      </View>
      <Text style={styles.kpiTitle}>{titulo}</Text>
      <Text style={styles.kpiDetails} numberOfLines={2}>
        {detalhes}
      </Text>
    </View>
  );
};

// ─── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  // Header Superior
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // Barra de Abas
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
  },
  navBarInner: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  navTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  navTabActive: {
    backgroundColor: '#EFF6FF',
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  navTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  // Área de Conteúdo
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingBottom: 40,
  },
  sectionWrap: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
  },
  groupHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Banner PDF Geral
  bannerPdf: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  bannerPdfContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bannerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPdfTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  bannerPdfSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  bannerPdfBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  bannerPdfBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Grid de KPIs
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexBasis: Platform.OS === 'web' ? '48%' : '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  kpiTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  kpiDetails: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },

  // Resumo do Mês
  monthlyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  monthlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  monthlyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  monthlyLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  monthlyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  monthlyValueBold: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  // Barra de Pesquisa
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    marginBottom: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
  },

  // Cartões de Pessoas (Dentistas / Secretários)
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
    gap: 12,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  personBody: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  personEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  personTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  specialtyTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  specialtyTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  triagensCountText: {
    fontSize: 11,
    color: '#64748B',
  },
  pdfActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pdfActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // Central PDF
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    gap: 14,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  docDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 17,
  },
  docBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  docBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  tipText: {
    fontSize: 12,
    color: '#047857',
    marginTop: 3,
    lineHeight: 17,
  },

  // Vazio e Loading
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
});

export default AdminReportsScreen;
