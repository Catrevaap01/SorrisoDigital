import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTriagensPaciente } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, RECOMENDACAO } from '../../utils/constants';
import { formatDateTime, formatRelativeTime } from '../../utils/helpers';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { PacienteTabParamList } from '../../navigation/types';

type HistoricoProps = BottomTabScreenProps<PacienteTabParamList, 'Histórico'>;

const HistoricoScreen: React.FC<HistoricoProps> = () => {
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todos');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [triagemSelecionada, setTriagemSelecionada] = useState<any | null>(null);

  const carregarTriagens = async () => {
    if (!profile?.id) return;
    
    const result = await buscarTriagensPaciente(profile.id);
    if (result.success) {
      setTriagens(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarTriagens();
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarTriagens();
    setRefreshing(false);
  }, [profile]);

  const filtros = [
    { id: 'todos', label: 'Todos' },
    { id: 'pendente', label: 'Pendentes' },
    { id: 'respondido', label: 'Respondidos' },
    { id: 'urgente', label: 'Urgentes' },
  ];

  const triagensFiltradas = filtroAtivo === 'todos'
    ? triagens
    : triagens.filter(t => t.status === filtroAtivo);

  const abrirDetalhes = (triagem) => {
    setTriagemSelecionada(triagem);
    setModalVisible(true);
  };

  const renderTriagem = ({ item }) => {
    const statusInfo = STATUS_TRIAGEM[item.status] || STATUS_TRIAGEM.pendente;
    const temResposta = item.respostas && item.respostas.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => abrirDetalhes(item)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color="#fff" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.cardData}>{formatRelativeTime(item.created_at)}</Text>
        </View>

        {/* Sintoma */}
        <Text style={styles.cardSintoma}>{item.sintoma_principal}</Text>

        {/* Descrição */}
        {item.descricao && (
          <Text style={styles.cardDescricao} numberOfLines={2}>
            {item.descricao}
          </Text>
        )}

        {/* Info Row */}
        <View style={styles.cardInfoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="fitness" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>Dor: {item.intensidade_dor}/10</Text>
          </View>

          {item.imagens && item.imagens.length > 0 && (
            <View style={styles.infoItem}>
              <Ionicons name="images" size={14} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{item.imagens.length} foto(s)</Text>
            </View>
          )}

          {item.duracao && (
            <View style={styles.infoItem}>
              <Ionicons name="time" size={14} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>{item.duracao}</Text>
            </View>
          )}
        </View>

        {/* Resposta Preview */}
        {temResposta && (
          <View style={styles.respostaPreview}>
            <View style={styles.respostaHeader}>
              <Ionicons name="chatbubbles" size={16} color={COLORS.secondary} />
              <Text style={styles.respostaHeaderText}>Resposta do Dentista</Text>
            </View>
            <Text style={styles.respostaTexto} numberOfLines={2}>
              {item.respostas[0].orientacao}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTriagemLinha = ({ item }) => {
    const statusInfo = STATUS_TRIAGEM[item.status] || STATUS_TRIAGEM.pendente;

    return (
      <TouchableOpacity
        style={styles.rowItem}
        onPress={() => abrirDetalhes(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.rowStatusDot, { backgroundColor: statusInfo.color }]} />
        <View style={styles.rowMain}>
          <Text style={styles.rowTitulo} numberOfLines={1}>
            {item.sintoma_principal || 'Sem descricao'}
          </Text>
          <Text style={styles.rowSubtitulo} numberOfLines={1}>
            {statusInfo.label} | Dor {item.intensidade_dor}/10 | {formatRelativeTime(item.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderModalDetalhes = () => {
    if (!triagemSelecionada) return null;

    const statusInfo = STATUS_TRIAGEM[triagemSelecionada.status] || STATUS_TRIAGEM.pendente;
    const resposta = triagemSelecionada.respostas?.[0];
    const recomendacaoInfo = resposta?.recomendacao 
      ? RECOMENDACAO[resposta.recomendacao] 
      : null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Triagem</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status */}
              <View style={[styles.modalStatusBadge, { backgroundColor: statusInfo.color }]}>
                <Ionicons name={statusInfo.icon as any} size={16} color="#fff" />
                <Text style={styles.modalStatusText}>{statusInfo.label}</Text>
              </View>

              {/* Informações Básicas */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Sintoma Principal</Text>
                <Text style={styles.modalValue}>{triagemSelecionada.sintoma_principal}</Text>
              </View>

              <View style={styles.modalRow}>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Data</Text>
                  <Text style={styles.modalValue}>
                    {formatDateTime(triagemSelecionada.created_at)}
                  </Text>
                </View>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Intensidade</Text>
                  <Text style={[
                    styles.modalValue,
                    triagemSelecionada.intensidade_dor >= 7 && styles.dorAlta
                  ]}>
                    {triagemSelecionada.intensidade_dor}/10
                  </Text>
                </View>
              </View>

              {triagemSelecionada.duracao && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Duração</Text>
                  <Text style={styles.modalValue}>{triagemSelecionada.duracao}</Text>
                </View>
              )}

              {triagemSelecionada.localizacao && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Localização</Text>
                  <Text style={styles.modalValue}>{triagemSelecionada.localizacao}</Text>
                </View>
              )}

              {triagemSelecionada.descricao && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Descrição</Text>
                  <Text style={styles.modalValueMultiline}>
                    {triagemSelecionada.descricao}
                  </Text>
                </View>
              )}

              {/* Imagens */}
              {triagemSelecionada.imagens && triagemSelecionada.imagens.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Fotos Enviadas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {triagemSelecionada.imagens.map((uri, index) => (
                      <Image
                        key={index}
                        source={{ uri }}
                        style={styles.modalImage}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Resposta do Dentista */}
              {resposta && (
                <View style={styles.respostaBox}>
                  <View style={styles.respostaBoxHeader}>
                    <Ionicons name="medical" size={20} color={COLORS.secondary} />
                    <Text style={styles.respostaBoxTitle}>Resposta do Profissional</Text>
                  </View>

                  {resposta.dentista?.nome && (
                    <Text style={styles.dentistaNome}>
                      Dr(a). {resposta.dentista.nome}
                      {resposta.dentista.especialidade && ` - ${resposta.dentista.especialidade}`}
                    </Text>
                  )}

                  <Text style={styles.respostaBoxText}>{resposta.orientacao}</Text>

                  {recomendacaoInfo && (
                    <View style={[styles.recomendacaoBadge, { backgroundColor: recomendacaoInfo.color + '20' }]}>
                      <Ionicons name={recomendacaoInfo.icon as any} size={18} color={recomendacaoInfo.color} />
                      <Text style={[styles.recomendacaoText, { color: recomendacaoInfo.color }]}>
                        {recomendacaoInfo.label}
                      </Text>
                    </View>
                  )}

                  {resposta.observacoes && (
                    <View style={styles.observacoesBox}>
                      <Text style={styles.observacoesLabel}>Observações:</Text>
                      <Text style={styles.observacoesText}>{resposta.observacoes}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Aviso */}
              <View style={styles.modalAviso}>
                <Ionicons name="information-circle" size={16} color={COLORS.accent} />
                <Text style={styles.modalAvisoText}>
                  Esta orientação não substitui avaliação presencial. 
                  Em caso de dúvidas ou piora dos sintomas, procure atendimento.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filtros.map((filtro) => (
            <TouchableOpacity
              key={filtro.id}
              style={[
                styles.filtroButton,
                filtroAtivo === filtro.id && styles.filtroButtonActive,
              ]}
              onPress={() => setFiltroAtivo(filtro.id)}
            >
              <Text
                style={[
                  styles.filtroText,
                  filtroAtivo === filtro.id && styles.filtroTextActive,
                ]}
              >
                {filtro.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : triagensFiltradas.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Nenhuma informacao</Text>
          <Text style={styles.emptySubtitle}>
            {filtroAtivo === 'todos'
              ? 'Ainda nao existe informacao no historico'
              : 'Nao ha informacao para este filtro'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={triagensFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={filtroAtivo === 'todos' ? renderTriagemLinha : renderTriagem}
          contentContainerStyle={filtroAtivo === 'todos' ? styles.listaLinhas : styles.lista}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={
            filtroAtivo === 'todos' ? () => <View style={styles.rowSeparator} /> : undefined
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de Detalhes */}
      {renderModalDetalhes()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filtrosContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    ...SHADOWS.sm,
  },
  filtroButton: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.background,
    marginRight: SIZES.sm,
  },
  filtroButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filtroText: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filtroTextActive: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.md,
  },
  emptySubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SIZES.xs,
  },
  lista: {
    padding: SIZES.md,
  },
  listaLinhas: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
  },
  rowStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SIZES.sm,
  },
  rowMain: {
    flex: 1,
  },
  rowTitulo: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
  },
  rowSubtitulo: {
    marginTop: 2,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  rowSeparator: {
    height: SIZES.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 4,
    borderRadius: SIZES.radiusFull,
  },
  statusText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontXs,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  cardData: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  cardSintoma: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  cardDescricao: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  cardInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SIZES.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SIZES.md,
    marginBottom: SIZES.xs,
  },
  infoText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  respostaPreview: {
    backgroundColor: '#E8F5E9',
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    marginTop: SIZES.sm,
  },
  respostaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.xs,
  },
  respostaHeaderText: {
    fontSize: SIZES.fontSm,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: SIZES.xs,
  },
  respostaTexto: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    maxHeight: '90%',
    paddingBottom: SIZES.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusFull,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
  },
  modalStatusText: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
    marginLeft: SIZES.xs,
  },
  modalSection: {
    paddingHorizontal: SIZES.md,
    marginTop: SIZES.md,
  },
  modalRow: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.md,
    marginTop: SIZES.md,
  },
  modalColumn: {
    flex: 1,
  },
  modalLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  modalValue: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '500',
  },
  modalValueMultiline: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    lineHeight: 22,
  },
  dorAlta: {
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  modalImage: {
    width: 120,
    height: 120,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.sm,
    marginTop: SIZES.sm,
  },
  respostaBox: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: SIZES.md,
    marginTop: SIZES.lg,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  respostaBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  respostaBoxTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginLeft: SIZES.sm,
  },
  dentistaNome: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  respostaBoxText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    lineHeight: 22,
  },
  recomendacaoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.md,
  },
  recomendacaoText: {
    fontWeight: 'bold',
    marginLeft: SIZES.sm,
  },
  observacoesBox: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: SIZES.sm,
    borderRadius: SIZES.radiusSm,
    marginTop: SIZES.md,
  },
  observacoesLabel: {
    fontSize: SIZES.fontSm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  observacoesText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  modalAviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    marginHorizontal: SIZES.md,
    marginTop: SIZES.lg,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  modalAvisoText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: '#E65100',
    lineHeight: 18,
  },
});

export default HistoricoScreen;

