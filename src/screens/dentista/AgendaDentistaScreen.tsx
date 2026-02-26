import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { buscarAgendaDentista } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDate } from '../../utils/helpers';

const AgendaDentistaScreen: React.FC = () => {
  const { profile } = useAuth();
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      case 'confirmado': return COLORS.secondary;
      case 'agendado': return COLORS.primary;
      case 'realizado': return COLORS.textSecondary;
      case 'cancelado': return COLORS.danger;
      default: return COLORS.textLight;
    }
  };

  const renderAgendamento = ({ item }) => {
    const hora = new Date(item.data_agendamento).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.agendamentoCard}>
        <View style={styles.horaContainer}>
          <Text style={styles.horaText}>{hora}</Text>
        </View>

        <View style={styles.agendamentoInfo}>
          <Text style={styles.pacienteNome}>{item.paciente?.nome || 'Paciente'}</Text>
          <Text style={styles.tipoConsulta}>{item.tipo}</Text>
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

        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
      </View>
    );
  };

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
          {agendamentos.length} agendamento(s)
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
        <FlatList
          data={agendamentos}
          keyExtractor={(item) => item.id}
          renderItem={renderAgendamento}
          contentContainerStyle={styles.lista}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Legenda */}
      <View style={styles.legendaContainer}>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaCor, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.legendaText}>Agendado</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaCor, { backgroundColor: COLORS.secondary }]} />
          <Text style={styles.legendaText}>Confirmado</Text>
        </View>
        <View style={styles.legendaItem}>
          <View style={[styles.legendaCor, { backgroundColor: COLORS.danger }]} />
          <Text style={styles.legendaText}>Cancelado</Text>
        </View>
      </View>
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
  agendamentoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
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
});

export default AgendaDentistaScreen;