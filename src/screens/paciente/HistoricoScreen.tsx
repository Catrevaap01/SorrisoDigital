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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  buscarTriagensPaciente,
  buscarTriagensDentista,
  buscarTodasTriagens,
} from '../../services/triagemService';
import { buscarAgendamentosPaciente } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, RECOMENDACAO, STATUS_AGENDAMENTO, TIPOS_CONSULTA } from '../../utils/constants';
import { formatDateTime, formatRelativeTime } from '../../utils/helpers';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { PacienteTabParamList } from '../../navigation/types';
import Loading from '../../components/ui/Loading';

type HistoricoProps = BottomTabScreenProps<PacienteTabParamList, 'Histórico'>;

const HistoricoScreen: React.FC<HistoricoProps> = () => {
  const { profile } = useAuth();
  const [triagens, setTriagens] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todos');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [triagemSelecionada, setTriagemSelecionada] = useState<any | null>(null);
  const [modalAgendamentoVisible, setModalAgendamentoVisible] = useState<boolean>(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<any | null>(null);

  const carregarTriagens = async () => {
    if (!profile?.id) return;

    const tipo = profile?.tipo;
    const result =
      tipo === 'dentista' || tipo === 'medico'
        ? await buscarTriagensDentista(profile.id)
        : tipo === 'admin'
          ? await buscarTodasTriagens({ status: null })
          : await buscarTriagensPaciente(profile.id);

    if (result.success) {
      setTriagens(result.data || []);
    }
    setLoading(false);
  };

  const carregarAgendamentos = async () => {
    if (!profile?.id) return;
    
    const result = await buscarAgendamentosPaciente(profile.id);
    if (result.success) {
      // Carrega todos os agendamentos (pendente, agendado, confirmado)
      // Quando o dentista confirmar, aparece como confirmado
      // Se cancelar, volta para pendente
      setAgendamentos(result.data || []);
    }
  };

  const carregarDados = async () => {
    await Promise.all([carregarTriagens(), carregarAgendamentos()]);
  };

  useEffect(() => {
    carregarDados();
  }, [profile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [profile]);

  const filtros = [
    { id: 'todos', label: 'Todos' },
    { id: 'pendente', label: 'Pend.' },
    { id: 'confirmado', label: 'Confirmado' },
    { id: 'cancelado', label: 'Cancel.' },
    { id: 'realizado', label: 'Realiz.' },
    { id: 'urgente', label: 'Urg.' },
  ];

  const triagensFiltradas =
    filtroAtivo === 'todos'
      ? triagens
      : triagens.filter((t) => {
          if (filtroAtivo === 'respondido') {
            return t.status === 'respondido' || (t.respostas && t.respostas.length > 0);
          }

          if (filtroAtivo === 'urgente') {
            return (
              t.status === 'urgente' ||
              t.prioridade === 'urgente' ||
              Number(t.intensidade_dor || 0) >= 8
            );
          }

          return t.status === filtroAtivo;
        });

  // Filtra agendamentos por status
  const agendamentosFiltrados =
    filtroAtivo === 'todos'
      ? agendamentos
      : agendamentos.filter((a) => {
          // Para "confirmado", mostra tanto "confirmado" quanto "agendado" (legado)
          if (filtroAtivo === 'confirmado') {
            return a.status === 'confirmado' || a.status === 'agendado';
          }
          // Para agendamentos, filtra por status
          return a.status === filtroAtivo;
        });

  // Combina triagens e agendamentos para exibir na lista
  const dadosCombinados = [
    ...triagensFiltradas.map((t) => ({ ...t, tipo: 'triagem' })),
    ...agendamentosFiltrados.map((a) => ({ ...a, tipo: 'agendamento' })),
  ].sort((a, b) => {
    const dataA = a.tipo === 'triagem' ? a.created_at : a.data_agendamento;
    const dataB = b.tipo === 'triagem' ? b.created_at : b.data_agendamento;
    return new Date(dataB).getTime() - new Date(dataA).getTime();
  });

  const abrirDetalhes = (triagem) => {
    setTriagemSelecionada(triagem);
    setModalVisible(true);
  };

  const abrirDetalhesAgendamento = (agendamento) => {
    setAgendamentoSelecionado(agendamento);
    setModalAgendamentoVisible(true);
  };

  const renderTriagem = ({ item }) => {
    const temResposta = item.respostas && item.respostas.length > 0;
    const effectiveStatus = temResposta ? 'respondido' : (item.status === 'urgente' || item.prioridade === 'urgente' || Number(item.intensidade_dor || 0) >= 8 ? 'urgente' : (item.status || 'pendente'));
    const statusInfo = STATUS_TRIAGEM[effectiveStatus] || STATUS_TRIAGEM.pendente;

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
              <Ionicons name="person-circle-outline" size={16} color={COLORS.secondary} />
              <Text style={styles.respostaHeaderText}>
                Dr(a). {item.respostas[0].dentista?.nome || 'Dentista'}
              </Text>
            </View>
            
            {item.respostas[0].recomendacao && (
              <Text style={styles.recomendacaoDestaque}>
                ⭐ {item.respostas[0].recomendacao}
              </Text>
            )}
            
            <Text style={styles.respostaTexto} numberOfLines={2}>
              {item.respostas[0].orientacao}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderAgendamento = ({ item }) => {
    const statusInfo = STATUS_AGENDAMENTO[item.status] || STATUS_AGENDAMENTO.pendente;
    const tipoConsulta = TIPOS_CONSULTA[item.tipo] || TIPOS_CONSULTA.consulta;

    return (
      <TouchableOpacity
        style={[styles.card, styles.cardAgendamento]}
        onPress={() => abrirDetalhesAgendamento(item)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={12} color="#fff" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.cardData}>{formatRelativeTime(item.data_agendamento)}</Text>
        </View>

        {/* Tipo de Consulta */}
        <View style={styles.tipoConsultaRow}>
          <Ionicons name={tipoConsulta.icon as any} size={20} color={tipoConsulta.color} />
          <Text style={[styles.tipoConsultaText, { color: tipoConsulta.color }]}>
            {tipoConsulta.label}
          </Text>
        </View>

        {/* Informações do Dentista */}
        {item.dentista && (
          <View style={styles.dentistaInfoRow}>
            <Ionicons name="person" size={14} color={COLORS.textSecondary} />
            <Text style={styles.dentistaNomeText}>
              Dr(a). {item.dentista.nome}
            </Text>
          </View>
        )}

        {/* Data e Hora */}
        <View style={styles.cardInfoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {new Date(item.data_agendamento).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={14} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>
              {new Date(item.data_agendamento).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Observações */}
        {item.observacoes && (
          <Text style={styles.cardDescricao} numberOfLines={2}>
            {item.observacoes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    if (item.tipo === 'agendamento') {
      return renderAgendamento({ item });
    }
    return renderTriagem({ item });
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

              {triagemSelecionada.respostas && triagemSelecionada.respostas.length > 0 && (
                <View style={[styles.modalSection, styles.modalSectionResposta]}>
                  <View style={styles.modalSectionHeader}>
                    <Ionicons name="chatbubbles" size={20} color={COLORS.secondary} />
                    <Text style={[styles.modalSectionTitle, { color: COLORS.secondary }]}>
                      Avaliação do Dentista
                    </Text>
                  </View>
                  
                  <View style={styles.dentistaInfoBox}>
                    <Ionicons name="person-circle" size={40} color={COLORS.secondary} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.modalDentistaNome}>
                        Dr(a). {triagemSelecionada.respostas[0].dentista?.nome || 'Dentista'}
                      </Text>
                      <Text style={styles.modalDentistaSub}>Profissional de Odontologia</Text>
                    </View>
                  </View>

                  {triagemSelecionada.respostas[0].recomendacao && (
                    <View style={styles.recomendacaoBox}>
                      <Text style={styles.recomendacaoLabel}>Recomendação:</Text>
                      <Text style={styles.recomendacaoValor}>
                        {triagemSelecionada.respostas[0].recomendacao}
                      </Text>
                    </View>
                  )}

                  <View style={styles.orientacaoBox}>
                    <Text style={styles.orientacaoLabel}>Orientação detalhada:</Text>
                    <Text style={styles.orientacaoValor}>
                      {triagemSelecionada.respostas[0].orientacao}
                    </Text>
                  </View>
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

  const renderModalDetalhesAgendamento = () => {
    if (!agendamentoSelecionado) return null;

    const statusInfo = STATUS_AGENDAMENTO[agendamentoSelecionado.status] || STATUS_AGENDAMENTO.pendente;
    const tipoConsulta = TIPOS_CONSULTA[agendamentoSelecionado.tipo] || TIPOS_CONSULTA.consulta;

    return (
      <Modal
        visible={modalAgendamentoVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalAgendamentoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes do Agendamento</Text>
              <TouchableOpacity
                onPress={() => setModalAgendamentoVisible(false)}
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

              {/* Tipo de Consulta */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Tipo de Consulta</Text>
                <View style={styles.tipoConsultaRow}>
                  <Ionicons name={tipoConsulta.icon as any} size={24} color={tipoConsulta.color} />
                  <Text style={[styles.tipoConsultaText, { color: tipoConsulta.color, marginLeft: SIZES.sm }]}>
                    {tipoConsulta.label}
                  </Text>
                </View>
              </View>

              {/* Informações do Dentista */}
              {agendamentoSelecionado.dentista && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Dentista</Text>
                  <Text style={styles.modalValue}>
                    Dr(a). {agendamentoSelecionado.dentista.nome}
                    {agendamentoSelecionado.dentista.especialidade && ` - ${agendamentoSelecionado.dentista.especialidade}`}
                  </Text>
                </View>
              )}

              {/* Data e Hora */}
              <View style={styles.modalRow}>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Data</Text>
                  <Text style={styles.modalValue}>
                    {new Date(agendamentoSelecionado.data_agendamento).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.modalColumn}>
                  <Text style={styles.modalLabel}>Hora</Text>
                  <Text style={styles.modalValue}>
                    {new Date(agendamentoSelecionado.data_agendamento).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {/* Observações */}
              {agendamentoSelecionado.observacoes && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Observações</Text>
                  <Text style={styles.modalValueMultiline}>
                    {agendamentoSelecionado.observacoes}
                  </Text>
                </View>
              )}

              {/* Aviso */}
              <View style={styles.modalAviso}>
                <Ionicons name="information-circle" size={16} color={COLORS.accent} />
                <Text style={styles.modalAvisoText}>
                  Em caso de dúvidas ou necessidade de remarcar, entre em contato conosco.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Main return statement - renderiza a tela de histórico
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Loading />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.filtrosContainer}>
        <FlatList
          horizontal
          data={filtros}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filtroButton,
                filtroAtivo === item.id && styles.filtroButtonActive,
              ]}
              onPress={() => setFiltroAtivo(item.id)}
            >
              <Text
                style={[
                  styles.filtroText,
                  filtroAtivo === item.id && styles.filtroTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Lista de dados combinados (triagens + agendamentos) */}
      {dadosCombinados.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Nenhum registro encontrado</Text>
          <Text style={styles.emptySubtitle}>
            Seus agendamentos e triagens aparecerão aqui
          </Text>
        </View>
      ) : (
        <FlatList
          data={dadosCombinados}
          keyExtractor={(item, index) => `${item.tipo}-${item.id}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      {/* Modais */}
      {renderModalDetalhes()}
      {renderModalDetalhesAgendamento()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: SIZES.xl + SIZES.md,
    paddingBottom: SIZES.lg,
    paddingHorizontal: SIZES.md,
  },
  headerTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.textInverse,
  },
  headerSubtitle: {
    fontSize: SIZES.fontSm,
    color: COLORS.textInverse,
    opacity: 0.8,
    marginTop: SIZES.xs,
  },
  filtrosContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  filtrosList: {
    paddingHorizontal: SIZES.md,
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
    fontSize: SIZES.fontSm,
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
  cardAgendamento: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
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
  tipoConsultaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  tipoConsultaText: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    marginLeft: SIZES.sm,
  },
  dentistaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  dentistaNomeText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    marginLeft: SIZES.xs,
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
    backgroundColor: '#F5FEF9',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  respostaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  respostaHeaderText: {
    fontSize: SIZES.fontSm,
    fontWeight: 'bold',
    color: COLORS.secondary,
    marginLeft: 6,
  },
  recomendacaoDestaque: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  respostaTexto: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    borderBottomLeftRadius: Platform.OS === 'web' ? SIZES.radiusXl : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? SIZES.radiusXl : 0,
    maxHeight: '90%',
    width: Platform.OS === 'web' ? '100%' : undefined,
    maxWidth: Platform.OS === 'web' ? 600 : undefined,
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
  modalSectionResposta: {
    backgroundColor: '#F0F9F4',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    marginHorizontal: 16,
  },
  modalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalSectionTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dentistaInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalDentistaNome: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalDentistaSub: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  recomendacaoBox: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  recomendacaoLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#2E7D32',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recomendacaoValor: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  orientacaoBox: {
    padding: 4,
  },
  orientacaoLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orientacaoValor: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
    lineHeight: 20,
  },
});

export default HistoricoScreen;


