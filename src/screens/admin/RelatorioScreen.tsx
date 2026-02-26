/**
 * Tela de Relatórios do Administrador
 * Visualiza e exporta relatórios de dentistas
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {
  gerarRelatorioGeral,
  gerarRelatorioDentista,
  exportarRelatorioCSV,
  exportarRelatorioJSON,
  gerarHTMLRelatorio,
  imprimirRelatorio,
} from '../../services/relatorioService';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { Button } from '../../components/ui/Button';

const RelatorioScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [relatorioCarregado, setRelatorioCarregado] = useState(false);
  const [dadosRelatorio, setDadosRelatorio] = useState<any>(null);
  const [modalExportacaoVisivel, setModalExportacaoVisivel] = useState(false);
  const [exportando, setExportando] = useState(false);

  const carregarRelatorio = useCallback(async () => {
    setLoading(true);
    try {
      const resultado = await gerarRelatorioGeral();
      if (resultado.success && resultado.data) {
        setDadosRelatorio(resultado.data);
        setRelatorioCarregado(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar relatório',
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Ocorreu um erro ao carregar o relatório',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarRelatorio();
    }, [carregarRelatorio])
  );

  const handleExportarJSON = async () => {
    setExportando(true);
    try {
      const filename = `relatorio-geral-${new Date().toISOString().split('T')[0]}.json`;
      exportarRelatorioJSON(dadosRelatorio, filename);
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Relatório exportado em JSON',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao exportar relatório',
      });
    } finally {
      setExportando(false);
      setModalExportacaoVisivel(false);
    }
  };

  const handleExportarCSV = async () => {
    setExportando(true);
    try {
      const filename = `relatorio-geral-${new Date().toISOString().split('T')[0]}.csv`;
      exportarRelatorioCSV(dadosRelatorio, filename);
      Toast.show({
        type: 'success',
        text1: 'Sucesso',
        text2: 'Relatório exportado em CSV',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao exportar relatório',
      });
    } finally {
      setExportando(false);
      setModalExportacaoVisivel(false);
    }
  };

  const handleImprimir = () => {
    try {
      const html = gerarHTMLRelatorio(dadosRelatorio);
      imprimirRelatorio(html);
      Toast.show({
        type: 'success',
        text1: 'Abrindo impressora',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: 'Erro ao preparar impressão',
      });
    } finally {
      setModalExportacaoVisivel(false);
    }
  };

  if (loading && !relatorioCarregado) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando relatório...</Text>
        </View>
      </View>
    );
  }

  if (!dadosRelatorio) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Nenhum dado disponível</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Relatório Geral</Text>
          <TouchableOpacity
            style={styles.botaoAtualizar}
            onPress={carregarRelatorio}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Cards de Resumo */}
        <View style={styles.resumoContainer}>
          <View style={[styles.resumoCard, { borderLeftColor: COLORS.primary }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={24} color={COLORS.primary} />
              <View style={{ marginLeft: SPACING.md }}>
                <Text style={styles.resumoValor}>{dadosRelatorio.totalDentistas}</Text>
                <Text style={styles.resumoLabel}>Total de Dentistas</Text>
              </View>
            </View>
          </View>

          <View style={[styles.resumoCard, { borderLeftColor: COLORS.success }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.success} />
              <View style={{ marginLeft: SPACING.md }}>
                <Text style={styles.resumoValor}>{dadosRelatorio.dentistasAtivos}</Text>
                <Text style={styles.resumoLabel}>Dentistas Ativos</Text>
              </View>
            </View>
          </View>

          <View style={[styles.resumoCard, { borderLeftColor: COLORS.info }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="document-outline" size={24} color={COLORS.info} />
              <View style={{ marginLeft: SPACING.md }}>
                <Text style={styles.resumoValor}>{dadosRelatorio.totalTriagens}</Text>
                <Text style={styles.resumoLabel}>Total de Triagens</Text>
              </View>
            </View>
          </View>

          <View style={[styles.resumoCard, { borderLeftColor: COLORS.success }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="trending-up-outline" size={24} color={COLORS.success} />
              <View style={{ marginLeft: SPACING.md }}>
                <Text style={styles.resumoValor}>{dadosRelatorio.percentualResposta}%</Text>
                <Text style={styles.resumoLabel}>Taxa de Resposta</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Botões de Exportação */}
        <View style={styles.botoesContainer}>
          <Button
            title="📊 Exportar / Imprimir"
            onPress={() => setModalExportacaoVisivel(true)}
          />
        </View>

        {/* Tabela de Dentistas */}
        <View style={styles.tabelaContainer}>
          <Text style={styles.tabelaTitulo}>Dentistas</Text>
          <View style={styles.tabelaHeader}>
            <Text style={[styles.tabelaCelula, styles.tabelaCelulaHeader, { flex: 2 }]}>
              Nome
            </Text>
            <Text style={[styles.tabelaCelula, styles.tabelaCelulaHeader, { flex: 1.5 }]}>
              Triagens
            </Text>
            <Text style={[styles.tabelaCelula, styles.tabelaCelulaHeader, { flex: 1 }]}>
              Taxa (%)
            </Text>
          </View>

          {dadosRelatorio.dentistas.map((dentista: any, index: number) => (
            <View key={index} style={styles.tabelaRow}>
              <Text style={[styles.tabelaCelula, { flex: 2 }]}>
                {dentista.dentista.nome || '-'}
              </Text>
              <Text style={[styles.tabelaCelula, { flex: 1.5 }]}>
                {dentista.triagensRespondidas}/{dentista.totalTriagens}
              </Text>
              <Text style={[styles.tabelaCelula, { flex: 1, color: COLORS.success }]}>
                {dentista.percentualResposta}%
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerText}>
          Última atualização: {new Date(dadosRelatorio.dataGeracao).toLocaleString('pt-AO')}
        </Text>
      </ScrollView>

      {/* Modal de Exportação */}
      <Modal
        visible={modalExportacaoVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalExportacaoVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Exportar / Imprimir</Text>
              <TouchableOpacity onPress={() => setModalExportacaoVisivel(false)}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.modalDescricao}>
                Escolha como deseja exportar ou imprimir o relatório:
              </Text>

              <TouchableOpacity
                style={styles.opcaoExportacao}
                onPress={handleImprimir}
                disabled={exportando}
              >
                <Ionicons name="print-outline" size={28} color={COLORS.primary} />
                <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                  <Text style={styles.opcaoTitulo}>Imprimir</Text>
                  <Text style={styles.opcaoSubtitulo}>
                    Abrir visualização de impressão
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.opcaoExportacao}
                onPress={handleExportarCSV}
                disabled={exportando}
              >
                <Ionicons name="document-outline" size={28} color={COLORS.info} />
                <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                  <Text style={styles.opcaoTitulo}>Exportar CSV</Text>
                  <Text style={styles.opcaoSubtitulo}>
                    Arquivo compatível com Excel
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.opcaoExportacao}
                onPress={handleExportarJSON}
                disabled={exportando}
              >
                <Ionicons name="code-outline" size={28} color={COLORS.success} />
                <View style={{ marginLeft: SPACING.md, flex: 1 }}>
                  <Text style={styles.opcaoTitulo}>Exportar JSON</Text>
                  <Text style={styles.opcaoSubtitulo}>
                    Arquivo estruturado em JSON
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.botaoModal, styles.botaoCancelar]}
                onPress={() => setModalExportacaoVisivel(false)}
                disabled={exportando}
              >
                <Text style={styles.botaoModalTexto}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  botaoAtualizar: {
    padding: SPACING.sm,
  },
  resumoContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  resumoCard: {
    backgroundColor: COLORS.card,
    borderLeftWidth: 4,
    padding: SPACING.md,
    borderRadius: 8,
  },
  resumoValor: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  resumoLabel: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  botoesContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  tabelaContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabelaTitulo: {
    fontSize: TYPOGRAPHY.sizes.h3,
    fontWeight: 'bold',
    color: COLORS.text,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tabelaCelula: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.text,
  },
  tabelaCelulaHeader: {
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  footerText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingBottom: SPACING.lg,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.body,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.h3,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalForm: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  modalDescricao: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  opcaoExportacao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: 8,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  opcaoTitulo: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  opcaoSubtitulo: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  botaoModal: {
    paddingVertical: SPACING.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botaoCancelar: {
    backgroundColor: COLORS.backgroundSecondary,
  },
  botaoModalTexto: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default RelatorioScreen;
