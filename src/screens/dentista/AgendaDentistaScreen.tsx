import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { buscarAgendaDentista } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDate } from '../../utils/helpers';
import { TIPOS_CONSULTA } from '../../utils/constants';

const AgendaDentistaScreen: React.FC<any> = ({ navigation }) => {
  const { profile } = useAuth();
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Gerar dias da semana atual
  const gerarSemana = () => {
    const dias = [];
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());

    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + i);
      dias.push(dia);
    }
    return dias;
  };

  const diasSemana = gerarSemana();

  const carregarAgendamentos = async () => {
    setLoading(true);
    const result = await buscarAgendaDentista(profile.id, dataSelecionada);
    if (result.success) {
      setAgendamentos(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarAgendamentos();
  }, [dataSelecionada]);

  const formatarDia = (data) => {
    const dias = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    return {
      diaSemana: dias[data.getDay()],
      dia: data.getDate(),
      isHoje: data.toDateString() === new Date().toDateString(),
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pendente': return COLORS.accent;
      case 'agendado': return COLORS.primary;
      case 'confirmado': return '#4CAF50';
      case 'realizado': return '#9C27B0';
      case 'cancelado': return COLORS.danger;
      default: return COLORS.textLight;
    }
  };

  const renderAgendamento = ({ item }) => {
    const hora = new Date(item.data_agendamento).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Obter label do tipo de consulta
    const tipoLabel = TIPOS_CONSULTA[item.tipo]?.label || item.tipo;

    const handleAbrirPaciente = () => {
      if (!item.paciente?.id) return;
      navigation.navigate('PacienteHistorico' as any, {
        pacienteId: item.paciente.id,
        pacienteNome: item.paciente.nome,
      });
    };

    const handleAgendar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      const { agendarAgendamento } = await import('../../services/agendamentoService');
      const res = await agendarAgendamento(item.id, profile.id);
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Agendamento agendado' });
        await carregarAgendamentos();
        setProcessingId(null);
        return;
      }
      setProcessingId(null);
      Toast.show({
        type: 'error',
        text1: 'Erro ao agendar',
        text2: res.error || 'Nao foi possivel agendar este paciente',
      });
    };

    const handleConfirmar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      const { confirmarAgendamento } = await import('../../services/agendamentoService');
      const res = await confirmarAgendamento(item.id, profile.id);
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Agendamento confirmado' });
        await carregarAgendamentos();
        setProcessingId(null);
        handleAbrirPaciente();
        return;
      }
      setProcessingId(null);
      Toast.show({
        type: 'error',
        text1: 'Erro ao confirmar',
        text2: res.error || 'Nao foi possivel confirmar este agendamento',
      });
    };

    const handleCancelar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      const { cancelarAgendamento } = await import('../../services/agendamentoService');
      const res = await cancelarAgendamento(item.id);
      if (res.success) {
        Toast.show({ type: 'info', text1: 'Agendamento voltou para pendente' });
        await carregarAgendamentos();
        setProcessingId(null);
        return;
      }
      setProcessingId(null);
      Toast.show({
        type: 'error',
        text1: 'Erro ao cancelar',
        text2: res.error || 'Nao foi possivel cancelar este agendamento',
      });
    };

    const handleRealizar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      const { realizarAgendamento } = await import('../../services/agendamentoService');
      const res = await realizarAgendamento(item.id);
      if (res.success) {
        Toast.show({ type: 'success', text1: 'Consulta realizada com sucesso!' });
        await carregarAgendamentos();
        setProcessingId(null);
        return;
      }
      setProcessingId(null);
      Toast.show({
        type: 'error',
        text1: 'Erro ao marcar',
        text2: res.error || 'Nao foi possivel marcar como realizado',
      });
    };

    return (
      <View style={styles.agendamentoCard}>
        <View style={styles.horaContainer}>
          <Text style={styles.horaText}>{hora}</Text>
        </View>

        <TouchableOpacity style={styles.agendamentoInfo} activeOpacity={0.8} onPress={handleAbrirPaciente}>
          <View>
            <Text style={styles.pacienteNome}>
              {item.paciente?.nome || item.paciente_nome || 'Paciente'}
            </Text>
            <Text style={styles.tipoConsulta}>{tipoLabel}</Text>
            {item.paciente?.telefone && (
              <Text style={styles.telefone}>
                <Ionicons name="call-outline" size={12} /> {item.paciente.telefone}
              </Text>
            )}
            {item.observacoes && (
              <Text style={styles.observacoes} numberOfLines={1}>
                {item.observacoes}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
        {(item.status === 'pendente' || item.status === 'agendado' || item.status === 'confirmado') && (
          <View style={styles.actionRow}>
            {item.status === 'pendente' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={handleAgendar}
                disabled={processingId === item.id}
              >
                <Ionicons name="calendar" size={16} color={COLORS.textInverse} />
                <Text style={styles.actionButtonText}>
                  {processingId === item.id ? 'Processando' : 'Agendar'}
                </Text>
              </TouchableOpacity>
            )}
            {item.status === 'agendado' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
                onPress={handleConfirmar}
                disabled={processingId === item.id}
              >
                <Ionicons name="checkmark-circle" size={16} color={COLORS.textInverse} />
                <Text style={styles.actionButtonText}>
                  {processingId === item.id ? 'Processando' : 'Confirmar'}
                </Text>
              </TouchableOpacity>
            )}
            {item.status === 'confirmado' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                onPress={handleRealizar}
                disabled={processingId === item.id}
              >
                <Ionicons name="checkmark-done" size={16} color={COLORS.textInverse} />
                <Text style={styles.actionButtonText}>
                  {processingId === item.id ? 'Processando' : 'Realizar'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
              onPress={handleCancelar}
              disabled={processingId === item.id}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textInverse} />
              <Text style={styles.actionButtonText}>
                {processingId === item.id ? 'Processando' : 'Cancelar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const pendentesDoDia = agendamentos.filter((a) => a.status === 'pendente');
  const meusAgendadosDoDia = agendamentos.filter(
    (a) =>
      a.dentista_id === profile.id &&
      a.status === 'agendado'
  );
  const meusConfirmadosDoDia = agendamentos.filter(
    (a) =>
      a.dentista_id === profile.id &&
      a.status === 'confirmado'
  );
  const realizadosDoDia = agendamentos.filter(
    (a) =>
      a.dentista_id === profile.id &&
      a.status === 'realizado'
  );
  const canceladosDoDia = agendamentos.filter(
    (a) => a.status === 'cancelado' && (!a.dentista_id || a.dentista_id === profile.id)
  );

  return (
    <View style={styles.container}>
      {/* Calendário Semanal */}
      <View style={styles.calendarioContainer}>
        <Text style={styles.mesAno}>
          {formatDate(dataSelecionada, 'MMMM yyyy')}
        </Text>
        
        <View style={styles.diasContainer}>
          {diasSemana.map((dia, index) => {
            const { diaSemana, dia: diaNum, isHoje } = formatarDia(dia);
            const isSelected = dia.toDateString() === dataSelecionada.toDateString();

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.diaCard,
                  isSelected && styles.diaCardSelected,
                  isHoje && !isSelected && styles.diaCardHoje,
                ]}
                onPress={() => setDataSelecionada(dia)}
              >
                <Text style={[
                  styles.diaSemanaText,
                  isSelected && styles.diaTextSelected,
                ]}>
                  {diaSemana}
                </Text>
                <Text style={[
                  styles.diaNumText,
                  isSelected && styles.diaTextSelected,
                  isHoje && !isSelected && styles.diaNumHoje,
                ]}>
                  {diaNum}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Data Selecionada */}
      <View style={styles.dataSelecionadaContainer}>
        <Text style={styles.dataSelecionadaText}>
          {formatDate(dataSelecionada, "EEEE, dd 'de' MMMM")}
        </Text>
        <Text style={styles.totalAgendamentos}>
          {agendamentos.length} agendamento(s) no dia
        </Text>
      </View>

      {/* Lista de Agendamentos */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : agendamentos.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="calendar-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
          <Text style={styles.emptySubtitle}>
            Não há consultas marcadas para este dia
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pendente</Text>
            <Text style={styles.sectionCount}>{pendentesDoDia.length}</Text>
          </View>
          {pendentesDoDia.length === 0 ? (
            <Text style={styles.sectionEmpty}>Sem pacientes pendentes neste dia.</Text>
          ) : (
            pendentesDoDia.map((item) => <View key={item.id}>{renderAgendamento({ item })}</View>)
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Agendado</Text>
            <Text style={styles.sectionCount}>{meusAgendadosDoDia.length}</Text>
          </View>
          {meusAgendadosDoDia.length === 0 ? (
            <Text style={styles.sectionEmpty}>
              Sem pacientes agendados por este dentista neste dia.
            </Text>
          ) : (
            meusAgendadosDoDia.map((item) => (
              <View key={`agendado-${item.id}`}>{renderAgendamento({ item })}</View>
            ))
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Confirmado</Text>
            <Text style={styles.sectionCount}>{meusConfirmadosDoDia.length}</Text>
          </View>
          {meusConfirmadosDoDia.length === 0 ? (
            <Text style={styles.sectionEmpty}>
              Sem pacientes confirmados por este dentista neste dia.
            </Text>
          ) : (
            meusConfirmadosDoDia.map((item) => (
              <View key={`meu-${item.id}`}>{renderAgendamento({ item })}</View>
            ))
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Realizado</Text>
            <Text style={styles.sectionCount}>{realizadosDoDia.length}</Text>
          </View>
          {realizadosDoDia.length === 0 ? (
            <Text style={styles.sectionEmpty}>Sem consultas realizadas neste dia.</Text>
          ) : (
            realizadosDoDia.map((item) => (
              <View key={`realizado-${item.id}`}>{renderAgendamento({ item })}</View>
            ))
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cancelado</Text>
            <Text style={styles.sectionCount}>{canceladosDoDia.length}</Text>
          </View>
          {canceladosDoDia.length === 0 ? (
            <Text style={styles.sectionEmpty}>Sem pacientes cancelados neste dia.</Text>
          ) : (
            canceladosDoDia.map((item) => (
              <View key={`cancelado-${item.id}`}>{renderAgendamento({ item })}</View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  calendarioContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.md,
    ...SHADOWS.sm,
  },
  mesAno: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SIZES.md,
    textTransform: 'capitalize',
  },
  diasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.sm,
  },
  diaCard: {
    alignItems: 'center',
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  diaCardSelected: {
    backgroundColor: COLORS.secondary,
  },
  diaCardHoje: {
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  diaSemanaText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  diaNumText: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  diaTextSelected: {
    color: COLORS.textInverse,
  },
  diaNumHoje: {
    color: COLORS.secondary,
  },
  dataSelecionadaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
  },
  dataSelecionadaText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  totalAgendamentos: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SIZES.xs,
  },
  sectionTitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '700',
  },
  sectionCount: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sectionEmpty: {
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
  },
  agendamentoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.sm,
    overflow: 'visible',
    ...SHADOWS.sm,
  },
  horaContainer: {
    backgroundColor: COLORS.secondary + '15',
    padding: SIZES.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
  },
  horaText: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.secondary,
  },
  agendamentoInfo: {
    flex: 1,
    padding: SIZES.md,
  },
  pacienteNome: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tipoConsulta: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  telefone: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  observacoes: {
    fontSize: SIZES.fontSm,
    color: COLORS.textLight,
    fontStyle: 'italic',
    marginTop: 4,
  },
  statusIndicator: {
    width: 4,
  },
  legendaContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: SIZES.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SIZES.md,
  },
  legendaCor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: SIZES.xs,
  },
  legendaText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  // ações de confirmar/cancelar
  actionRow: {
    justifyContent: 'center',
    paddingHorizontal: SIZES.sm,
    gap: SIZES.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZES.radiusSm,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    minWidth: 108,
  },
  actionButtonText: {
    marginLeft: SIZES.xs,
    color: COLORS.textInverse,
    fontSize: SIZES.fontSm,
    fontWeight: '700',
  },
});

export default AgendaDentistaScreen;
