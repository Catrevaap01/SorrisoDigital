import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useDentist } from '../../contexts/DentistContext';
import { criarAgendamento } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PacienteStackParamList } from '../../navigation/types';

type AgendamentoProps = NativeStackScreenProps<PacienteStackParamList, 'Agendamento'>;

const AgendamentoScreen: React.FC<AgendamentoProps> = ({ navigation }) => {
  const { profile } = useAuth();
  const { selectedDentist, selectDentist } = useDentist();
  const [loading, setLoading] = useState<boolean>(false);
  
  // Dados do agendamento
  const [tipoConsulta, setTipoConsulta] = useState<string>('');
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<string>('');
  const [dentistas, setDentistas] = useState<any[]>([]);
  const [dentistaSelecionado, setDentistaSelecionado] = useState<string | null>(null);

  const tiposConsulta = [
    { id: 'consulta', label: 'Consulta de Rotina', icon: 'calendar', cor: COLORS.primary },
    { id: 'avaliacao', label: 'Avaliação Inicial', icon: 'search', cor: COLORS.secondary },
    { id: 'retorno', label: 'Retorno', icon: 'refresh', cor: COLORS.accent },
    { id: 'urgencia', label: 'Urgência', icon: 'alert-circle', cor: COLORS.danger },
    { id: 'raio_x', label: 'Exame de Raio X', icon: 'camera', cor: '#7B1FA2' },
    { id: 'panoramico', label: 'Panorâmico Periapical', icon: 'scan', cor: '#388E3C' },
    { id: 'profilaxia', label: 'Profilaxia', icon: 'water', cor: '#00BCD4' },
    { id: 'branqueamento', label: 'Branqueamento', icon: 'sparkles', cor: '#FF9800' },
    { id: 'canal', label: 'Tratamento de Canal', icon: 'git-commit', cor: '#E91E63' },
    { id: 'ortodontia', label: 'Aparelho Dentário', icon: 'construct', cor: '#3F51B5' },
    { id: 'restauracao', label: 'Restauração', icon: 'brush', cor: '#795548' },
  ];

  // Gerar próximos 14 dias
  const gerarDatas = () => {
    const datas = [];
    const hoje = new Date();
    
    for (let i = 1; i <= 14; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      
      // Pular domingos
      if (data.getDay() !== 0) {
        datas.push(data);
      }
    }
    return datas;
  };

  const datas = gerarDatas();

  // Horários disponíveis
  const horarios = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ];

  const formatarData = (data) => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return {
      dia: data.getDate(),
      diaSemana: dias[data.getDay()],
      mes: meses[data.getMonth()],
    };
  };

  // load dentists list
  React.useEffect(() => {
    (async () => {
      const { listarDentistas } = await import('../../services/dentistaService');
      const res = await listarDentistas();
      if (res.success && res.data) {
        setDentistas(res.data);
      }
    })();
  }, []);

  // preselect from context
  useEffect(() => {
    if (selectedDentist) {
      setDentistaSelecionado(selectedDentist.id);
    }
  }, [selectedDentist]);

  useEffect(() => {
    if (!selectedDentist) {
      Alert.alert(
        'Dentista obrigatório',
        'Você deve selecionar um dentista antes de agendar.',
        [
          {
            text: 'Escolher agora',
            onPress: () => navigation.getParent()?.navigate('ChooseDentista' as any),
          },
        ],
        { cancelable: false }
      );
    }
  }, [selectedDentist]);

  const handleAgendar = async () => {
    if (!tipoConsulta) {
      Toast.show({ type: 'error', text1: 'Selecione o tipo de consulta' });
      return;
    }
    if (!dataSelecionada) {
      Toast.show({ type: 'error', text1: 'Selecione uma data' });
      return;
    }
    if (!horarioSelecionado) {
      Toast.show({ type: 'error', text1: 'Selecione um horário' });
      return;
    }
    if (!dentistaSelecionado) {
      Toast.show({ type: 'error', text1: 'Selecione um dentista' });
      navigation.getParent()?.navigate('ChooseDentista' as any);
      return;
    }

    Alert.alert(
      'Confirmar Agendamento',
      `Deseja agendar para ${formatarData(dataSelecionada).dia}/${formatarData(dataSelecionada).mes} às ${horarioSelecionado}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: processarAgendamento },
      ]
    );
  };

  const processarAgendamento = async () => {
    setLoading(true);

    // Criar data/hora completa
    const [hora, minuto] = horarioSelecionado.split(':');
    const dataAgendamento = new Date(dataSelecionada);
    dataAgendamento.setHours(parseInt(hora), parseInt(minuto), 0, 0);

    const result = await criarAgendamento({
      paciente_id: profile.id,
      data_agendamento: dataAgendamento.toISOString(),
      tipo: tipoConsulta,
      observacoes: observacoes.trim(),
      status: 'pendente',
      dentista_id: dentistaSelecionado || null,
    });

    setLoading(false);

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Agendamento realizado!',
        text2: 'Você receberá uma confirmação em breve',
      });
      navigation.goBack();
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro ao agendar',
        text2: 'Tente novamente mais tarde',
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 24}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
      {/* Selecionar dentista (opcional) */}
      {dentistas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enviar para</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => {
              const alertOptions = dentistas.map((d) => ({
                text: d.nome,
                onPress: () => {
                  setDentistaSelecionado(d.id);
                  selectDentist({ id: d.id, nome: d.nome, foto_url: d.foto_url });
                },
              }));

              Alert.alert('Escolher dentista', '', [
                ...alertOptions,
                { text: 'Cancelar', style: 'cancel' },
              ]);
            }}
          >
            <Text style={[styles.selectText, !dentistaSelecionado && styles.selectPlaceholder]}>
              {dentistaSelecionado
                ? dentistas.find((d) => d.id === dentistaSelecionado)?.nome
                : 'Selecione (opcional)'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Tipo de Consulta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de Consulta</Text>
        <View style={styles.tiposGrid}>
          {tiposConsulta.map((tipo) => (
            <TouchableOpacity
              key={tipo.id}
              style={[
                styles.tipoCard,
                tipoConsulta === tipo.id && styles.tipoCardActive,
                tipoConsulta === tipo.id && { borderColor: tipo.cor },
              ]}
              onPress={() => setTipoConsulta(tipo.id)}
            >
              <Ionicons
                name={tipo.icon as any}
                size={28}
                color={tipoConsulta === tipo.id ? tipo.cor : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.tipoLabel,
                  tipoConsulta === tipo.id && { color: tipo.cor },
                ]}
              >
                {tipo.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Seleção de Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selecione a Data</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {datas.map((data, index) => {
            const formatted = formatarData(data);
            const isSelected = dataSelecionada?.getTime() === data.getTime();
            
            return (
              <TouchableOpacity
                key={index}
                style={[styles.dataCard, isSelected && styles.dataCardActive]}
                onPress={() => setDataSelecionada(data)}
              >
                <Text style={[styles.dataDiaSemana, isSelected && styles.dataTextActive]}>
                  {formatted.diaSemana}
                </Text>
                <Text style={[styles.dataDia, isSelected && styles.dataTextActive]}>
                  {formatted.dia}
                </Text>
                <Text style={[styles.dataMes, isSelected && styles.dataTextActive]}>
                  {formatted.mes}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Seleção de Horário */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Selecione o Horário</Text>
        <View style={styles.horariosGrid}>
          {horarios.map((horario) => {
            const isSelected = horarioSelecionado === horario;
            // Simulação: alguns horários indisponíveis
            const indisponivel = Math.random() < 0.2;
            
            return (
              <TouchableOpacity
                key={horario}
                style={[
                  styles.horarioCard,
                  isSelected && styles.horarioCardActive,
                  indisponivel && styles.horarioCardDisabled,
                ]}
                onPress={() => !indisponivel && setHorarioSelecionado(horario)}
                disabled={indisponivel}
              >
                <Text
                  style={[
                    styles.horarioText,
                    isSelected && styles.horarioTextActive,
                    indisponivel && styles.horarioTextDisabled,
                  ]}
                >
                  {horario}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Observações */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Observações (opcional)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Descreva brevemente o motivo da consulta..."
          placeholderTextColor={COLORS.textLight}
          value={observacoes}
          onChangeText={setObservacoes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Resumo */}
      {tipoConsulta && dataSelecionada && horarioSelecionado && (
        <View style={styles.resumoCard}>
          <Text style={styles.resumoTitle}>Resumo do Agendamento</Text>
          <View style={styles.resumoRow}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.resumoText}>
              {formatarData(dataSelecionada).dia} de {formatarData(dataSelecionada).mes} às {horarioSelecionado}
            </Text>
          </View>
          <View style={styles.resumoRow}>
            <Ionicons name="medical" size={18} color={COLORS.primary} />
            <Text style={styles.resumoText}>
              {tiposConsulta.find(t => t.id === tipoConsulta)?.label}
            </Text>
          </View>
        </View>
      )}

      {/* Botão Agendar */}
      <TouchableOpacity
        style={[styles.agendarButton, loading && styles.buttonDisabled]}
        onPress={handleAgendar}
        disabled={loading}
      >
        {loading ? (
          <Text style={styles.agendarButtonText}>Agendando...</Text>
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.textInverse} />
            <Text style={styles.agendarButtonText}>Confirmar Agendamento</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Aviso */}
      <View style={styles.avisoContainer}>
        <Ionicons name="information-circle" size={18} color={COLORS.accent} />
        <Text style={styles.avisoText}>
          O agendamento está sujeito à disponibilidade. 
          Você receberá uma confirmação por notificação.
        </Text>
      </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SIZES.xl + 24,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    padding: SIZES.md,
  },
  sectionTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  tiposGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tipoCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    alignItems: 'center',
    marginBottom: SIZES.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tipoCardActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  tipoLabel: {
    marginTop: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  dataCard: {
    width: 70,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.sm,
    alignItems: 'center',
    marginRight: SIZES.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dataCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dataDiaSemana: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  dataDia: {
    fontSize: SIZES.fontXxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dataMes: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  dataTextActive: {
    color: COLORS.textInverse,
  },
  horariosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  horarioCard: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    marginRight: SIZES.sm,
    marginBottom: SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  horarioCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  horarioCardDisabled: {
    backgroundColor: COLORS.divider,
    borderColor: COLORS.divider,
  },
  horarioText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  horarioTextActive: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
  },
  horarioTextDisabled: {
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resumoCard: {
    backgroundColor: '#E3F2FD',
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  resumoTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SIZES.sm,
  },
  resumoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SIZES.xs,
  },
  resumoText: {
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  agendarButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    marginHorizontal: SIZES.md,
    marginTop: SIZES.lg,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: COLORS.secondaryLight,
  },
  agendarButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    marginLeft: SIZES.sm,
  },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SIZES.md,
    marginTop: SIZES.md,
    padding: SIZES.md,
    backgroundColor: '#FFF3E0',
    borderRadius: SIZES.radiusMd,
  },
  avisoText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: '#E65100',
    lineHeight: 18,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  selectPlaceholder: {
    color: COLORS.textSecondary,
  },
});

export default AgendamentoScreen;
