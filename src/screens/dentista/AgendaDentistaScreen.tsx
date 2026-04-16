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
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import {
  buscarAgendaDentista,
  agendarAgendamento,
  confirmarAgendamento,
  cancelarAgendamento,
  sugerirNovoHorario,
  rejeitarAgendamento,
} from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDate } from '../../utils/helpers';
import { TIPOS_CONSULTA } from '../../utils/constants';

const PRECO_POR_TIPO: Record<string, number> = {
  consulta: 25000,
  avaliacao: 30000,
  retorno: 15000,
  urgencia: 45000,
  raio_x: 20000,
  panoramico: 35000,
  profilaxia: 22000,
  branqueamento: 60000,
  canal: 90000,
  ortodontia: 120000,
  restauracao: 40000,
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 });

const AgendaDentistaScreen: React.FC<any> = ({ navigation }) => {
  const { profile } = useAuth();
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sugestaoAbertaPara, setSugestaoAbertaPara] = useState<string | null>(null);
  const [sugestaoData, setSugestaoData] = useState(new Date());
  const [sugestaoHorario, setSugestaoHorario] = useState('08:00');

  // Gerar dias do mês atual
  const gerarMes = () => {
    const dias = [];
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaInicio = primeiroDia.getDay();

    // Adicionar dias do mês anterior para completar a semana
    const mesAnterior = new Date(ano, mes, 0);
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const dia = new Date(mesAnterior);
      dia.setDate(mesAnterior.getDate() - i);
      dias.push({ ...dia, isMesAtual: false });
    }

    // Adicionar todos os dias do mês atual
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      const dia = new Date(ano, mes, i);
      dias.push({ ...dia, isMesAtual: true });
    }

    // Adicionar dias do próximo mês para completar a última semana
    const proximoMes = new Date(ano, mes + 1, 1);
    const diasRestantes = 42 - dias.length; // 6 semanas * 7 dias
    for (let i = 0; i < diasRestantes; i++) {
      const dia = new Date(proximoMes);
      dia.setDate(proximoMes.getDate() + i);
      dias.push({ ...dia, isMesAtual: false });
    }

    return dias;
  };

  const diasMes = gerarMes();

  const carregarAgendamentos = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // Ensure we're using the correct date without timezone issues
    const dataParaBusca = new Date(dataSelecionada);
    dataParaBusca.setHours(0, 0, 0, 0); // Set to midnight to avoid timezone issues
    
    const result = await buscarAgendaDentista(profile.id, dataParaBusca);
    if (result.success) {
      setAgendamentos(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarAgendamentos();
  }, [dataSelecionada, profile?.id]);

  const formatarDia = (diaData) => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    // Ensure diaData is a Date object
    const dataObj = new Date(diaData);
    // Create date at midnight to avoid timezone issues
    const data = new Date(dataObj.getFullYear(), dataObj.getMonth(), dataObj.getDate());
    data.setHours(0, 0, 0, 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const selecionada = new Date(dataSelecionada);
    selecionada.setHours(0, 0, 0, 0);
    
    return {
      diaSemana: dias[data.getDay()],
      dia: data.getDate(),
      isHoje: data.getTime() === hoje.getTime(),
      isSelecionado: data.getTime() === selecionada.getTime(),
      isMesAtual: diaData.isMesAtual !== false,
    };
  };

  const selecionarDia = (dia) => {
    if (dia.isMesAtual) {
      // Ensure dia is a Date object
      const diaObj = new Date(dia);
      // Create date at midnight to avoid timezone issues
      const novaData = new Date(diaObj.getFullYear(), diaObj.getMonth(), diaObj.getDate());
      novaData.setHours(0, 0, 0, 0);
      setDataSelecionada(novaData);
    }
  };

  const renderDiaCalendar = ({ item }) => {
    const formatacao = formatarDia(item);
    return (
      <TouchableOpacity
        key={item.getDate()}
        style={[
          styles.diaCalendar,
          !formatacao.isMesAtual && styles.diaForaMes,
          formatacao.isHoje && styles.diaHoje,
          formatacao.isSelecionado && styles.diaSelecionado,
        ]}
        onPress={() => selecionarDia(item)}
        disabled={!formatacao.isMesAtual}
      >
        <Text style={[
          styles.diaSemanaText,
          !formatacao.isMesAtual && styles.textoForaMes,
          formatacao.isSelecionado && styles.textoSelecionado,
        ]}>
          {formatacao.diaSemana}
        </Text>
        <Text style={[
          styles.diaNumeroText,
          !formatacao.isMesAtual && styles.textoForaMes,
          formatacao.isSelecionado && styles.textoSelecionado,
        ]}>
          {formatacao.dia}
        </Text>
      </TouchableOpacity>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'solicitado': return COLORS.accent;
      case 'atribuido_dentista': return COLORS.primary;
      case 'reagendamento_solicitado': return '#F59E0B';
      case 'confirmado_dentista': return '#4CAF50';
      case 'rejeitado_dentista': return COLORS.danger;
      case 'realizado': return '#9C27B0';
      case 'cancelado': return COLORS.danger;
      default: return COLORS.textLight;
    }
  };

  const sugestaoDatas = () => {
    const datas = [];
    const hoje = new Date();
    for (let i = 1; i <= 7; i += 1) {
      const dia = new Date(hoje);
      dia.setDate(hoje.getDate() + i);
      if (dia.getDay() !== 0) {
        datas.push(dia);
      }
    }
    return datas;
  };

  const sugestaoHorarios = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  ];

  const formatSuggestionLabel = (data: Date) => {
    return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1)
      .toString()
      .padStart(2, '0')} ${sugestaoHorario}`;
  };

  const renderAgendamento = ({ item }) => {
    const hora = formatDate(item.appointment_date, 'HH:mm') || '--:--';

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
      if (!profileId) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (processingId) return;
      setProcessingId(item.id);
      const res = await agendarAgendamento(item.id, profileId);
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
        text2: (typeof res.error === 'string' ? res.error : res.error?.message) || 'Não foi possível agendar este paciente',
      });
    };

    const handleConfirmar = async () => {
      if (!profileId) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (processingId) return;
      setProcessingId(item.id);
      const res = await confirmarAgendamento(item.id, profileId);
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
        text2: (typeof res.error === 'string' ? res.error : res.error?.message) || 'Não foi possível confirmar este agendamento',
      });
    };

    const handleRejeitar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      const res = await rejeitarAgendamento(item.id, 'Agendamento rejeitado pelo dentista');
      if (res.success) {
        Toast.show({ type: 'info', text1: 'Agendamento rejeitado' });
        await carregarAgendamentos();
        setProcessingId(null);
        return;
      }
      setProcessingId(null);
      Toast.show({
        type: 'error',
        text1: 'Erro ao rejeitar',
        text2: (typeof res.error === 'string' ? res.error : res.error?.message) || 'Não foi possível rejeitar o agendamento',
      });
    };

    const handleReagendarSugestao = async () => {
      if (!profileId) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (!sugestaoAbertaPara) return;
      if (processingId) return;
      setProcessingId(item.id);
      
      try {
        // Accept the suggested date and automatically assign dentist
        const { error: updateError } = await supabase
          .from('agendamentos')
          .update({ 
            appointment_date: item.suggested_date,
            status: 'confirmado_dentista',
            dentist_id: profileId, // Automatically assign this dentist
            suggested_date: null,
            suggested_by: null
          })
          .eq('id', item.id);
          
        if (updateError) {
          throw new Error(updateError.message || 'Erro ao atualizar data');
        }
        
        Toast.show({ 
          type: 'success', 
          text1: 'Agendamento reagendado automaticamente', 
          text2: `Data atualizada para ${formatDate(new Date(item.suggested_date), "dd/MM/yyyy 'às' HH:mm")} e dentista atribuído` 
        });
        
        // Notify secretary about the automatic assignment
        await notificarSecretarioReagendamento(item);
        
        await carregarAgendamentos();
        setProcessingId(null);
      } catch (error) {
        setProcessingId(null);
        Toast.show({
          type: 'error',
          text1: 'Erro ao reagendar',
          text2: error.message || 'Não foi possível reagendar o agendamento',
        });
      }
    };

    const handleRejeitarSugestao = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      
      try {
        // Reject the suggested date and send back to secretary
        const { error: updateError } = await supabase
          .from('agendamentos')
          .update({ 
            status: 'pendente', // Send back to pending for secretary
            dentist_id: null, // Remove dentist assignment
            suggested_date: null,
            suggested_by: null
          })
          .eq('id', item.id);
          
        if (updateError) {
          throw new Error(updateError.message || 'Erro ao rejeitar data');
        }
        
        Toast.show({ 
          type: 'info', 
          text1: 'Data rejeitada', 
          text2: 'Agendamento enviado de volta para a secretária' 
        });
        
        // Notify secretary about the rejection
        await notificarSecretarioRejeitamento(item);
        
        await carregarAgendamentos();
        setProcessingId(null);
      } catch (error) {
        setProcessingId(null);
        Toast.show({
          type: 'error',
          text1: 'Erro ao rejeitar',
          text2: error.message || 'Não foi possível rejeitar a data',
        });
      }
    };

    const notificarSecretarioReagendamento = async (agendamento: any) => {
      try {
        // Create notification for secretary
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: null, // Will be filtered by RLS for secretaries
            title: 'Reagendamento Confirmado',
            message: `Dentista confirmou reagendamento para ${agendamento.paciente?.nome} na data ${formatDate(new Date(agendamento.suggested_date), "dd/MM/yyyy 'às' HH:mm")}`,
            type: 'reschedule_confirmed',
            data: {
              appointment_id: agendamento.id,
              patient_id: agendamento.patient_id,
              dentist_id: profileId,
              old_date: agendamento.appointment_date,
              new_date: agendamento.suggested_date
            },
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.warn('Erro ao notificar secretário:', error);
        }
      } catch (error) {
        console.warn('Erro ao criar notificação:', error);
      }
    };

    const handleAbrirSugestao = () => {
      setSugestaoAbertaPara(item.id);
      setSugestaoData(new Date());
      setSugestaoHorario('08:00');
      
      // Mostrar notificação sobre data sugerida pelo paciente
      Toast.show({
        type: 'info',
        text1: 'Data Sugerida',
        text2: `Paciente sugeriu data: ${formatDate(new Date(item.suggested_date), "dd/MM/yyyy 'às' HH:mm")}`,
      });
    };

    const handleEnviarSugestao = async () => {
      if (!profileId) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (!sugestaoAbertaPara) return;
      if (processingId) return;
      setProcessingId(item.id);
      const horarioIso = new Date(sugestaoData);
      const [hora, minuto] = sugestaoHorario.split(':');
      horarioIso.setHours(Number(hora), Number(minuto), 0, 0);
      
      try {
        // First suggest the new time
        const res = await sugerirNovoHorario(item.id, profileId, horarioIso.toISOString());
        if (!res.success) {
          const errorMessage = typeof res.error === 'string' ? res.error : res.error?.message || 'Não foi possível sugerir o horário';
          throw new Error(errorMessage);
        }
        
        // Then update appointment status to send it back to secretary
        const { error: updateError } = await supabase
          .from('agendamentos')
          .update({ 
            status: 'pendente', // Send back to pending for secretary
            dentist_id: null, // Remove dentist assignment
            suggested_date: horarioIso.toISOString(),
            suggested_by: profileId
          })
          .eq('id', item.id);
          
        if (updateError) {
          console.warn('Erro ao atualizar status do agendamento:', updateError);
        }
        
        Toast.show({ 
          type: 'success', 
          text1: 'Horário sugerido com sucesso', 
          text2: `Paciente enviado para secretária com nova data: ${formatDate(horarioIso, "dd/MM/yyyy 'às' HH:mm")}` 
        });
        
        // Notify secretary about the suggestion
        await notificarSecretarioSugestao(item, horarioIso);
        
        setSugestaoAbertaPara(null);
        await carregarAgendamentos();
        setProcessingId(null);
      } catch (error) {
        setProcessingId(null);
        Toast.show({
          type: 'error',
          text1: 'Erro ao sugerir horário',
          text2: error.message || 'Não foi possível sugerir o horário',
        });
      }
    };

    const notificarSecretarioSugestao = async (agendamento: any, novaData: Date) => {
      try {
        // Create notification for secretary
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: null, // Will be filtered by RLS for secretaries
            title: 'Nova Sugestão de Horário',
            message: `Dentista sugeriu nova data para ${agendamento.paciente?.nome}: ${formatDate(novaData, "dd/MM/yyyy 'às' HH:mm")}`,
            type: 'date_suggested',
            data: {
              appointment_id: agendamento.id,
              patient_id: agendamento.patient_id,
              dentist_id: profileId,
              suggested_date: novaData.toISOString()
            },
            created_at: new Date().toISOString()
          });
          
        if (error) {
          console.warn('Erro ao notificar secretário:', error);
        }
      } catch (error) {
        console.warn('Erro ao criar notificação:', error);
      }
    };

    const handleCancelar = async () => {
      if (processingId) return;
      setProcessingId(item.id);
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
        text2: (typeof res.error === 'string' ? res.error : res.error?.message) || 'Não foi possível cancelar este agendamento',
      });
    };

    const handlePagamentoParcial = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      
      const valorTotal = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
      const valorPago = item.valor_pago || 0;
      const valorPendente = valorTotal - valorPago;
      
      if (valorPendente <= 0) {
        setProcessingId(null);
        Toast.show({ type: 'info', text1: 'Sem pendente', text2: 'Não há valor pendente para pagamento parcial.' });
        return;
      }
      
      const res = await supabase
        .from('agendamentos')
        .update({ 
          valor_pago: valorPago + valorPendente,
          valor_pendente: 0
        })
        .eq('id', item.id);
      
      setProcessingId(null);
      if (res.error) {
        Toast.show({
          type: 'error',
          text1: 'Erro no pagamento',
          text2: res.error.message || 'Não foi possível processar pagamento parcial',
        });
      } else {
        Toast.show({ type: 'success', text1: 'Pagamento registrado', text2: 'Pagamento parcial processado com sucesso!' });
        await carregarAgendamentos();
      }
    };

    const handleMarcarComoPago = async () => {
      if (processingId) return;
      setProcessingId(item.id);
      
      const valorTotal = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
      
      const res = await supabase
        .from('agendamentos')
        .update({ 
          valor_pago: valorTotal,
          valor_pendente: 0
        })
        .eq('id', item.id);
      
      setProcessingId(null);
      if (res.error) {
        Toast.show({
          type: 'error',
          text1: 'Erro no pagamento',
          text2: res.error.message || 'Não foi possível marcar como pago',
        });
      } else {
        Toast.show({ type: 'success', text1: 'Pagamento completo', text2: 'Consulta marcada como paga!' });
        await carregarAgendamentos();
      }
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
        text2: (typeof res.error === 'string' ? res.error : res.error?.message) || 'Não foi possível marcar como realizado',
      });
    };

    return (
      <View style={styles.agendamentoCard}>
        <View style={styles.horaContainer}>
          <Text style={styles.horaText}>{hora}</Text>
        </View>

        <TouchableOpacity style={styles.agendamentoInfo} activeOpacity={(item.status === 'confirmado_dentista' || item.status === 'atribuido_dentista') ? 1 : 0.8} onPress={(item.status === 'confirmado_dentista' || item.status === 'atribuido_dentista') ? undefined : handleAbrirPaciente}>
          <View>
            <Text style={styles.pacienteNome}>
              {item.paciente?.nome || item.patient_name || 'Paciente'}
            </Text>
            <Text style={styles.tipoConsulta}>{tipoLabel}</Text>
            {item.paciente?.telefone && (
              <Text style={styles.telefone}>
                <Ionicons name="call-outline" size={12} /> {item.paciente.telefone}
              </Text>
            )}
            {item.observacoes && (
              <Text style={styles.observacoes} numberOfLines={1}>
                {item.notes || item.observacoes}
              </Text>
            )}
            <Text style={styles.valorLabel}>
              Valor estimado: {formatCurrency(PRECO_POR_TIPO[item.tipo || 'consulta'] || 0)}
            </Text>
            {(item.valor_pago || item.valor_pendente) && (
              <View style={styles.pagamentoContainer}>
                <Text style={styles.pagamentoLabel}>
                  Pago: {formatCurrency(item.valor_pago || 0)}
                </Text>
                <Text style={styles.pagamentoLabel}>
                  Pendente: {formatCurrency(item.valor_pendente || 0)}
                </Text>
              </View>
            )}
          </View>
          {(item.status === 'confirmado_dentista' || item.status === 'atribuido_dentista') && (
            <View style={{ marginLeft: 16, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', color: item.status === 'confirmado_dentista' ? '#4CAF50' : '#F59E0B', fontSize: 12 }}>
                {item.status === 'confirmado_dentista' ? 'Confirmado' : 'Atribuído'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
        
        {item.status === 'reagendamento_solicitado' && item.suggested_date && (
          <View style={styles.suggestedDateContainer}>
            <Text style={styles.suggestedDateLabel}>Data sugerida pelo paciente:</Text>
            <Text style={styles.suggestedDateValue}>
              {formatDate(new Date(item.suggested_date), "dd/MM/yyyy 'às' HH:mm")}
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, styles.rescheduleButton]} 
              onPress={handleReagendarSugestao} 
              disabled={processingId === item.id}
            >
              <Ionicons name="checkmark-circle" size={16} color={COLORS.textInverse} />
              <Text style={styles.actionButtonText}>Aceitar e Reagendar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
              onPress={handleRejeitarSugestao}
              disabled={processingId === item.id}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textInverse} />
              <Text style={styles.actionButtonText}>Rejeitar Data</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {(item.status === 'atribuido_dentista' || item.status === 'reagendamento_solicitado' || item.status === 'confirmado_dentista') && (
          <View style={styles.actionRow}>
            {(item.status === 'atribuido_dentista' || item.status === 'reagendamento_solicitado') && (
              <>
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
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
                  onPress={handleAbrirSugestao}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="swap-horizontal" size={16} color={COLORS.textInverse} />
                  <Text style={styles.actionButtonText}>
                    Sugerir
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
                  onPress={handleRejeitar}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="close-circle" size={16} color={COLORS.textInverse} />
                  <Text style={styles.actionButtonText}>
                    Rejeitar
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === 'confirmado_dentista' && (
              <>
                {(!item.valor_pago || item.valor_pago < (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0)) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: COLORS.warning }]}
                    onPress={() => handlePagamentoParcial(item)}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="wallet-outline" size={16} color={COLORS.textInverse} />
                    <Text style={styles.actionButtonText}>
                      {processingId === item.id ? 'Processando' : 'Pagamento Parcial'}
                    </Text>
                  </TouchableOpacity>
                )}
                {(item.valor_pago && item.valor_pago >= (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0)) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
                    onPress={handleMarcarComoPago}
                    disabled={processingId === item.id}
                  >
                    <Ionicons name="checkmark-done-circle" size={16} color={COLORS.textInverse} />
                    <Text style={styles.actionButtonText}>
                      {processingId === item.id ? 'Processando' : 'Marcar como Pago'}
                    </Text>
                  </TouchableOpacity>
                )}
                {(!item.valor_pago || item.valor_pago < (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0)) && (
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
              </>
            )}
            {item.status === 'solicitado' || item.status === 'confirmado_dentista' ? (
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
            ) : null}
          </View>
        )}
        {sugestaoAbertaPara === item.id && (
          <View style={styles.suggestionPanel}>
            <Text style={styles.suggestionTitle}>Sugerir novo horário</Text>
            <View style={styles.suggestionRow}>
              {sugestaoDatas().map((data, index) => {
                const active = data.toDateString() === sugestaoData.toDateString();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.suggestionDate, active && styles.suggestionDateActive]}
                    onPress={() => setSugestaoData(data)}
                  >
                    <Text style={[styles.suggestionDateText, active && styles.suggestionDateTextActive]}>
                      {data.getDate()}/{data.getMonth() + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.suggestionRowWrap}>
              {sugestaoHorarios.map((hora) => {
                const active = sugestaoHorario === hora;
                return (
                  <TouchableOpacity
                    key={hora}
                    style={[styles.suggestionTime, active && styles.suggestionTimeActive]}
                    onPress={() => setSugestaoHorario(hora)}
                  >
                    <Text style={[styles.suggestionTimeText, active && styles.suggestionTimeTextActive]}>{hora}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.suggestionActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.secondary, flex: 1 }]}
                onPress={handleEnviarSugestao}
                disabled={processingId === item.id}
              >
                <Ionicons name="send" size={16} color={COLORS.textInverse} />
                <Text style={styles.actionButtonText}>Enviar sugestão</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.danger, flex: 1 }]}
                onPress={() => setSugestaoAbertaPara(null)}
                disabled={processingId === item.id}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textInverse} />
                <Text style={styles.actionButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const profileId = profile?.id;
  const pendentesDoDia = agendamentos.filter((a) => 
    a.dentist_id === profileId &&
    (a.status === 'solicitado' || a.status === 'atribuido_dentista')
  );
  const meusAgendadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      (a.status === 'reagendamento_solicitado' || a.status === 'atribuido_dentista')
  );
  const meusConfirmadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      (a.status === 'confirmado_dentista' || a.status === 'confirmado_paciente' || a.status === 'notificado_paciente')
  );
  const realizadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      a.status === 'realizado'
  );
  const canceladosDoDia = agendamentos.filter(
    (a) => a.status === 'cancelado' && (!a.dentist_id || a.dentist_id === profileId)
  );

  return (
    <View style={styles.container}>
      {/* Calendário Mensal */}
      <View style={styles.calendarContainer}>
        <Text style={styles.mesAnoText}>
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.diasScrollContainer}
        >
          {diasMes.map((dia, index) => (
            renderDiaCalendar({ item: dia, key: index })
          ))}
        </ScrollView>
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
  diasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SIZES.sm,
  },
  diasScrollContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.sm,
  },
  calendarContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  mesAnoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  calendarGrid: {
    gap: 8,
  },
  diaCalendar: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    minWidth: 40,
    minHeight: 60,
    justifyContent: 'center',
  },
  diaForaMes: {
    opacity: 0.3,
  },
  diaHoje: {
    backgroundColor: COLORS.primary + '20',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  diaSelecionado: {
    backgroundColor: COLORS.primary,
  },
  diaSemanaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  diaNumeroText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  textoForaMes: {
    color: COLORS.textSecondary,
  },
  textoSelecionado: {
    color: '#ffffff',
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
  valorLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  pagamentoContainer: {
    flexDirection: 'column',
    marginTop: SIZES.xs,
  },
  pagamentoLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginBottom: 2,
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
  suggestionPanel: {
    backgroundColor: '#fff7e6',
    borderRadius: SIZES.radiusMd,
    margin: SIZES.sm,
    padding: SIZES.sm,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  suggestionTitle: {
    fontWeight: '700',
    color: '#B45309',
    marginBottom: SIZES.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.xs,
    marginBottom: SIZES.sm,
  },
  suggestionDate: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  suggestionDateActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  suggestionDateText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  suggestionDateTextActive: {
    color: COLORS.textInverse,
  },
  suggestionRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SIZES.xs,
    marginBottom: SIZES.sm,
  },
  suggestionTime: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  suggestionTimeActive: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  suggestionTimeText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  suggestionTimeTextActive: {
    color: COLORS.textInverse,
  },
  suggestionActions: {
    flexDirection: 'row',
    gap: SIZES.xs,
    marginTop: SIZES.sm,
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
  suggestedDateContainer: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 12,
    marginVertical: 8,
    borderRadius: 4,
  },
  suggestedDateLabel: {
    fontSize: 12,
    color: '#856404',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  suggestedDateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  rescheduleButton: {
    backgroundColor: '#28A745',
  },
});

export default AgendaDentistaScreen;
