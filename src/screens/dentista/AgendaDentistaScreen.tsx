import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Platform,
  Alert,
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
  const [planoValores, setPlanoValores] = useState<Record<string, number>>({}); // patientId -> valor concluido
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sugestaoAbertaPara, setSugestaoAbertaPara] = useState<string | null>(null);
  const [sugestaoData, setSugestaoData] = useState(new Date());
  const [sugestaoHorario, setSugestaoHorario] = useState('08:00');

  // Buscar valores de plano de tratamento concluídos para cada paciente
  const carregarValoresPlano = async (ags: any[]) => {
    const pacienteIds = [...new Set(ags.map(a => a.patient_id || a.paciente?.id).filter(Boolean))];
    if (pacienteIds.length === 0) return;
    
    // Otimizado: seleciona apenas o que é necessário para calcular o valor total
    const { data } = await supabase
      .from('planos_tratamento')
      .select('paciente_id, procedimentos_tratamento(valor)')
      .in('paciente_id', pacienteIds)
      .eq('status', 'concluido');
      
    const mapa: Record<string, number> = {};
    (data || []).forEach((plano: any) => {
      const pid = plano.paciente_id;
      const valorTotal = (plano.procedimentos_tratamento || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      if (valorTotal > 0) mapa[pid] = valorTotal;
    });
    setPlanoValores(mapa);
  };

  // Gerar dias do mês selecionado (apenas mês atual)
  const gerarMes = () => {
    const dias = [];
    const ano = dataSelecionada.getFullYear();
    const mes = dataSelecionada.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const diaSemanaInicio = primeiroDia.getDay();

    // Adicionar apenas dias do mês atual
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      const dia = new Date(ano, mes, i);
      dias.push({ date: dia, isMesAtual: true });
    }

    return dias;
  };

  const diasMes = useMemo(() => gerarMes(), [dataSelecionada]);

  const carregarAgendamentos = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const ano = dataSelecionada.getFullYear();
    const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
    const dia = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataParaBusca = `${ano}-${mes}-${dia}`;
    
    const result = await buscarAgendaDentista(profile.id, dataParaBusca);
    if (result.success) {
      setAgendamentos(result.data);
      await carregarValoresPlano(result.data || []);
    }
    setLoading(false);
  };

  // REALTIME: Subscribe to appointment changes for this dentist
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`agenda-dentista-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `dentist_id=eq.${profile.id}`,
      }, () => {
        void carregarAgendamentos();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [profile?.id]);

  useEffect(() => {
    carregarAgendamentos();
  }, [dataSelecionada, profile?.id]);

  const formatarDia = (diaData) => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    // Get the Date object from the new structure
    const dataObj = diaData.date || diaData;
    // Ensure dataObj is a Date object
    const data = new Date(dataObj);
    // Create date at midnight to avoid timezone issues
    const dataNormalizada = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    dataNormalizada.setHours(0, 0, 0, 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const selecionada = new Date(dataSelecionada);
    selecionada.setHours(0, 0, 0, 0);
    
    return {
      diaSemana: dias[dataNormalizada.getDay()],
      dia: dataNormalizada.getDate(),
      isHoje: dataNormalizada.getTime() === hoje.getTime(),
      isSelecionado: dataNormalizada.getTime() === selecionada.getTime(),
      isMesAtual: diaData.isMesAtual !== false,
    };
  };

  const selecionarDia = (dia) => {
    if (dia.isMesAtual) {
      // Get the Date object from the new structure
      const diaObj = dia.date || dia;
      // Ensure diaObj is a Date object
      const data = new Date(diaObj);
      // Create date at midnight to avoid timezone issues
      const novaData = new Date(data.getFullYear(), data.getMonth(), data.getDate());
      novaData.setHours(0, 0, 0, 0);
      setDataSelecionada(novaData);
    }
  };

  const mudarMes = (direcao: number) => {
    const novaData = new Date(dataSelecionada);
    novaData.setMonth(novaData.getMonth() + direcao);
    novaData.setDate(1); // Reset to first day of month
    setDataSelecionada(novaData);
  };

  const irParaHoje = () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    setDataSelecionada(hoje);
  };

  const renderDiaCalendar = ({ item }) => {
    const formatacao = formatarDia(item);
    return (
      <TouchableOpacity
        key={formatacao.dia}
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

  
  const handleImprimirRelatorioGeralFaturacao = async () => {
    try {
      // Importar a função de exportação PDF
      const { exportHtmlAsPdf } = await import('../../utils/pdfExportUtils');
      
      // Filtrar todos os agendamentos realizados do dentista
      const realizadosTodos = agendamentos.filter(a => 
        a.dentist_id === profileId && 
        a.status === 'realizado'
      );
      
      if (realizadosTodos.length === 0) {
        Toast.show({ 
          type: 'info', 
          text1: 'Sem dados', 
          text2: 'Não há consultas realizadas para gerar relatório geral.' 
        });
        return;
      }
      
      // Calcular totais gerais
      const totalFaturado = realizadosTodos.reduce((total, item) => {
        const preco = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
        return total + preco;
      }, 0);
      
      const totalRecebido = realizadosTodos.reduce((total, item) => {
        return total + (item.valor_pago || 0);
      }, 0);
      
      const totalPendente = totalFaturado - totalRecebido;
      
      // Agrupar por data
      const agrupadosPorData = realizadosTodos.reduce((acc: Record<string, any[]>, item: any) => {
        const data = formatDate(item.appointment_date, 'dd/MM/yyyy');
        if (!acc[data]) {
          acc[data] = [];
        }
        acc[data].push(item);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Gerar HTML do relatório
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Relatório Geral de Faturação</title>
          <style>
            @page { margin: 1cm; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #333; }
            .subtitle { font-size: 16px; color: #666; margin-top: 5px; }
            .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .summary-label { font-weight: bold; }
            .summary-value { font-weight: bold; color: #333; }
            .total-row { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
            .date-section { margin-bottom: 30px; }
            .date-title { font-size: 18px; font-weight: bold; color: #7C3AED; margin-bottom: 10px; border-bottom: 2px solid #7C3AED; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .status-pago { color: #4CAF50; font-weight: bold; }
            .status-pendente { color: #F59E0B; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Relatório Geral de Faturação</div>
            <div class="subtitle">Dr(a). ${profile?.nome || 'Dentista'}</div>
            <div class="subtitle">Período: Todos os agendamentos realizados</div>
            <div class="subtitle" style="margin-top: 10px; font-size: 11px; color: #7C3AED;">
              Emitido por: ${profile?.nome || 'Dentista'}
            </div>
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">Total de Consultas:</span>
              <span class="summary-value">${realizadosTodos.length}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Faturado:</span>
              <span class="summary-value">${formatCurrency(totalRecebido)}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Recebido:</span>
              <span class="summary-value">${formatCurrency(totalRecebido)}</span>
            </div>
            <div class="summary-row total-row">
              <span class="summary-label">Total Pendente:</span>
              <span class="summary-value" style="color: ${totalPendente > 0 ? '#dc2626' : '#16a34a'}">
                ${formatCurrency(totalPendente)}
              </span>
            </div>
          </div>
          
           ${(() => {
            return Object.entries(agrupadosPorData).map(([data, itens]) => {
              const rowsHtml = (itens as any[]).map((item: any) => {
                const preco = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
                const recebido = item.valor_pago || 0;
                const divida = preco - recebido;
                const status = recebido >= preco ? 'pago' : 'pendente';
                
                return `
                  <tr>
                    <td>${item.appointment_time || '--:--'}</td>
                    <td>${item.paciente?.nome || item.patient_name || 'Paciente'}</td>
                    <td>${TIPOS_CONSULTA[item.tipo]?.label || item.tipo || 'consulta'}</td>
                    <td style="color:#16a34a; font-weight:bold;">${formatCurrency(recebido)}</td>
                    <td style="color: ${divida > 0 ? '#dc2626' : '#16a34a'}">${formatCurrency(divida)}</td>
                    <td class="status-${status}">
                      ${status === 'pago' ? 'Pago' : `Pendente: ${formatCurrency(divida)}`}
                    </td>
                  </tr>
                `;
              }).join('');

              return `
                <div class="date-section">
                  <div class="date-title">${data}</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Paciente</th>
                        <th>Tipo</th>
                        <th>Valor Pago</th>
                        <th>Dívida</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rowsHtml}
                    </tbody>
                  </table>
                </div>
              `;
            }).join('');
          })()}
          
          <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
            Relatório gerado em ${new Date().toLocaleString('pt-BR')}
          </div>
        </body>
        </html>
      `;
      
      const result = await exportHtmlAsPdf(htmlContent, `relatorio-geral-faturacao-${formatDate(new Date(), 'dd-MM-yyyy')}`);
      
      if (result.success) {
        Toast.show({ 
          type: 'success', 
          text1: 'Relatório gerado', 
          text2: 'Relatório geral de faturação gerado com sucesso!' 
        });
      } else {
        Toast.show({ 
          type: 'error', 
          text1: 'Erro ao gerar relatório', 
          text2: result.error || 'Tente novamente' 
        });
      }
    } catch (error) {
      Toast.show({ 
        type: 'error', 
        text1: 'Erro ao imprimir relatório', 
        text2: 'Não foi possível gerar o relatório geral de faturação.' 
      });
    }
  };

  const renderAgendamento = ({ item }) => {
    // Ocultar agendamentos pendentes apenas se não estiverem atribuídos a ninguém (pool geral)
    // No painel do dentista, se chegou no buscarAgendaDentista, já está atribuído a ele
    if (item.status === 'pendente' && !item.dentist_id) {
      return null;
    }
    
    // Usar data sugerida se existir, senão usar data original
    const dataBase = item.suggested_date || item.appointment_date;
    const isSuggested = !!item.suggested_date;

    // Extrair hora com segurança: 
    // Prioridade para appointment_time, se for 00:00 e houver sugestão, tenta a sugestão
    let hora = item.appointment_time?.substring(0, 5) || '--:--';
    
    // Se a hora for 00:00 ou padrão, e houver uma string ISO com tempo em dataBase, usa ela
    if ((hora === '--:--' || hora === '00:00') && typeof dataBase === 'string' && dataBase.includes('T')) {
      const timePart = dataBase.split('T')[1]?.substring(0, 5);
      if (timePart) hora = timePart;
    }

    const dataCompleta = formatDate(dataBase) || '--/--/----';
    const isDataSugerida = !!item.suggested_date;

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
        
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Agendamento Confirmado',
            'Deseja preencher o Plano de Tratamento e definir o valor para este paciente?',
            [
              { text: 'Agora não', onPress: handleAbrirPaciente, style: 'cancel' },
              { text: 'Sim, preencher plano', onPress: () => {
                navigation.navigate('PlanoTratamento' as any, {
                  pacienteId: item.paciente?.id,
                  pacienteNome: item.paciente?.nome,
                  triagemId: item.triagem_id || null // Passamos a triagem associada
                });
              }}
            ]
          );
        } else {
          // No web
          const irParaPlano = window.confirm('Agendamento confirmado!\nDeseja preencher o Plano de Tratamento e definir o valor para este paciente agora?');
          if (irParaPlano) {
            navigation.navigate('PlanoTratamento' as any, {
              pacienteId: item.paciente?.id,
              pacienteNome: item.paciente?.nome,
              triagemId: item.triagem_id || null
            });
          } else {
            handleAbrirPaciente();
          }
        }
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
        // Extrair hora da sugestão se disponível
        let suggestedTime = item.appointment_time;
        if (typeof item.suggested_date === 'string' && item.suggested_date.includes('T')) {
          suggestedTime = item.suggested_date.split('T')[1].substring(0, 8);
        }

        const { error: updateError } = await supabase
          .from('appointments') // Use appointments instead of agendamentos
          .update({ 
            appointment_date: item.suggested_date,
            appointment_time: suggestedTime,
            status: 'confirmado_dentista',
            dentist_id: profileId,
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
          .from('appointments')
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

    const notificarSecretarioRejeitamento = async (agendamento: any) => {
      try {
        // Create notification for secretary
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: null, // Will be filtered by RLS for secretaries
            title: 'Data Rejeitada',
            message: `Dentista rejeitou data para ${agendamento.paciente?.nome}`,
            type: 'date_rejected',
            data: {
              appointment_id: agendamento.id,
              patient_id: agendamento.patient_id,
              dentist_id: profileId,
              rejected_date: agendamento.suggested_date
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
          .from('appointments')
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

    const handleImprimirRecibo = async (item: any) => {
      try {
        // Importar a função de exportação PDF
        const { exportHtmlAsPdf } = await import('../../utils/pdfExportUtils');
        
        const html = `
          <div style="max-width:600px; margin:0 auto; padding:40px; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#334155; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <div style="text-align:center; margin-bottom:40px;">
              <h1 style="color:#7C3AED; margin:0; font-size:24px;">RECIBO DE PAGAMENTO</h1>
              <p style="margin:5px 0; font-size:14px; color:#64748b;">Sorriso Digital - Clínica Odontológica</p>
            </div>
            
            <div style="margin-bottom:30px;">
              <h3 style="font-size:12px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px;">Dados do Paciente</h3>
              <p style="margin:4px 0; font-weight:bold; color:#1e293b;">${item.paciente?.nome || 'Paciente'}</p>
              <p style="margin:4px 0; font-size:13px; color:#64748b;">Telefone: ${item.paciente?.telefone || 'Não informado'}</p>
            </div>
            
            <div style="margin-bottom:30px;">
              <h3 style="font-size:12px; text-transform:uppercase; color:#94a3b8; margin-bottom:10px;">Detalhes do Pagamento</h3>
              <p style="margin:4px 0; color:#1e293b;">Procedimento: ${item.tipo || 'Consulta'}</p>
              <p style="margin:4px 0; color:#1e293b;">Valor Total: ${formatCurrency(PRECO_POR_TIPO[item.tipo || 'consulta'] || 0)}</p>
              <p style="margin:4px 0; color:#16a34a; font-weight:bold;">Valor Pago: ${formatCurrency(item.valor_pago || 0)}</p>
              <p style="margin:4px 0; color:#dc2626;">Dívida Restante: ${formatCurrency((PRECO_POR_TIPO[item.tipo || 'consulta'] || 0) - (item.valor_pago || 0))}</p>
            </div>
            
            <div style="margin-top:60px; padding-top:20px; border-top:1px solid #f1f5f9; text-align:center; color:#94a3b8; font-size:12px;">
              <p>Recibo emitido em ${formatDate(new Date().toISOString(), "dd/MM/yyyy 'às' HH:mm")}</p>
              <p>Obrigado por confiar no Sorriso Digital.</p>
            </div>
          </div>
        `;
        
        const result = await exportHtmlAsPdf(html, `recibo-pagamento-${item.id}.pdf`);
        if (result.success) {
          Toast.show({ type: 'success', text1: 'Recibo gerado', text2: 'Recibo de pagamento pronto para impressão.' });
        } else {
          Toast.show({ type: 'error', text1: 'Erro ao gerar recibo', text2: result.error || 'Tente novamente' });
        }
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Erro ao imprimir recibo', text2: 'Não foi possível gerar o recibo.' });
      }
    };

    return (
      <View style={styles.agendamentoCard}>
        <View style={styles.horaContainer}>
          <Text style={styles.horaText}>{hora}</Text>
        </View>

        {/*Handle opening patient when confirmed -> goes to PlanoTratamento; when not confirmed -> PacienteHistorico */}
        <TouchableOpacity 
          style={styles.agendamentoInfo} 
          activeOpacity={0.8} 
          onPress={() => {
            if (!item.paciente?.id) return;
            if (item.status === 'confirmado_dentista' || item.status === 'realizado') {
              navigation.navigate('PlanoTratamento' as any, {
                pacienteId: item.paciente.id,
                pacienteNome: item.paciente.nome,
              });
            } else {
              handleAbrirPaciente();
            }
          }}
        >
          <View>
            <Text style={[styles.pacienteNome, (item.status === 'confirmado_dentista' || item.status === 'realizado') && { color: COLORS.primary, textDecorationLine: 'underline' }]}>
              {item.paciente?.nome || item.patient_name || 'Paciente'}
            </Text>
            <Text style={styles.tipoConsulta}>{tipoLabel}</Text>
            <Text style={[styles.dataText, isDataSugerida && styles.dataSugerida]}>
              {dataCompleta}
              {isDataSugerida && ' (Sugerida)'}
            </Text>
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
            {/* Show real plano value if concluded, otherwise estimated price */}
            {(() => {
              const patientId = item.patient_id || item.paciente?.id;
              const valorPlano = patientId ? planoValores[patientId] : undefined;
              const valorPadrao = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
              const valorMostrar = valorPlano ?? valorPadrao;
              const labelValor = valorPlano ? 'Valor da consulta (plano concluído)' : 'Valor estimado';
              return (
                <Text style={[styles.valorLabel, valorPlano && { color: COLORS.secondary || '#059669', fontWeight: 'bold' }]}>
                  {labelValor}: {formatCurrency(valorMostrar)}
                </Text>
              );
            })()}
            {(() => {
              const patientId = item.patient_id || item.paciente?.id;
              const valorReferencia = (patientId && planoValores[patientId]) || (PRECO_POR_TIPO[item.tipo || 'consulta'] || 0);
              const pago = item.valor_pago || 0;
              const divida = valorReferencia - pago;
              
              if (pago > 0) {
                return (
                  <View style={styles.pagamentoContainer}>
                    <Text style={styles.pagamentoLabel}>
                      Pago: {formatCurrency(pago)}
                    </Text>
                    {divida > 0 && (
                      <Text style={styles.pagamentoLabel}>
                        Dívida: {formatCurrency(divida)}
                      </Text>
                    )}
                    {divida <= 0 && (
                      <TouchableOpacity 
                        style={styles.reciboButton}
                        onPress={() => handleImprimirRecibo(item)}
                      >
                        <Ionicons name="receipt" size={14} color={COLORS.textInverse} />
                        <Text style={styles.reciboButtonText}>Imprimir Recibo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
              return null;
            })()}
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
  <View style={styles.sugestaoContainer}>
    <Text style={styles.sugestaoLabel}>
      Data sugerida pelo paciente:
    </Text>

    <Text style={styles.sugestaoValue}>
      {item.suggested_date ? 
        (() => {
          const dataSugerida = new Date(item.suggested_date);
          return dataSugerida && !isNaN(dataSugerida.getTime()) 
            ? dataSugerida.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : 'Data inválida';
        })()
        : 'Data não informada'
      }
    </Text>

    <TouchableOpacity
      style={[styles.actionButton, styles.rescheduleButton]}
      onPress={handleReagendarSugestao}
      disabled={processingId === item.id}
    >
      <Ionicons
        name="checkmark-circle"
        size={16}
        color={COLORS.textInverse}
      />
      <Text style={styles.actionButtonText}>
        Aceitar e Reagendar
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.actionButton,
        { backgroundColor: COLORS.danger },
      ]}
      onPress={handleRejeitarSugestao}
      disabled={processingId === item.id}
    >
      <Ionicons
        name="close-circle"
        size={16}
        color={COLORS.textInverse}
      />
      <Text style={styles.actionButtonText}>
        Rejeitar Data
      </Text>
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
                {false && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: COLORS.warning }]}
                    onPress={() => handlePagamentoParcial()}
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
  // Criar data no formato YYYY-MM-DD sem timezone para comparação correta
  const ano = dataSelecionada.getFullYear();
  const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
  const dia = String(dataSelecionada.getDate()).padStart(2, '0');
  const dataSelecionadaStr = `${ano}-${mes}-${dia}`;
  
  const meusAgendadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      ['atribuido_dentista', 'pendente', 'agendado', 'solicitado', 'agendamento_pendente_secretaria'].includes(a.status) &&
      (a.appointment_date === dataSelecionadaStr || (typeof a.appointment_date === 'string' && a.appointment_date.startsWith(dataSelecionadaStr)))
  );
  const meusConfirmadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      ['confirmado_dentista', 'confirmado_paciente', 'notificado_paciente'].includes(a.status) &&
      (a.appointment_date === dataSelecionadaStr || (typeof a.appointment_date === 'string' && a.appointment_date.startsWith(dataSelecionadaStr)))
  );
  const realizadosDoDia = agendamentos.filter(
    (a) =>
      a.dentist_id === profileId &&
      a.status === 'realizado' &&
      (a.appointment_date === dataSelecionadaStr || (typeof a.appointment_date === 'string' && a.appointment_date.startsWith(dataSelecionadaStr)))
  );
  const canceladosDoDia = agendamentos.filter(
    (a) => 
      a.status === 'cancelado' && 
      (!a.dentist_id || a.dentist_id === profileId) &&
      (a.appointment_date === dataSelecionadaStr || (typeof a.appointment_date === 'string' && a.appointment_date.startsWith(dataSelecionadaStr)))
  );

  return (
    <View style={styles.container}>
      {/* Calendário Mensal */}
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => mudarMes(-1)}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          <View style={styles.monthYearContainer}>
            <Text style={styles.mesAnoText}>
              {dataSelecionada.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity 
              style={styles.todayButton} 
              onPress={irParaHoje}
            >
              <Text style={styles.todayButtonText}>Hoje</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={() => mudarMes(1)}
          >
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.diasScrollContainer}
        >
          {diasMes.map((dia, index) => (
            renderDiaCalendar({ item: dia })
          ))}
        </ScrollView>
      </View>

      {/* Data Selecionada */}
      <View style={styles.dataSelecionadaContainer}>
        <Text style={styles.dataSelecionadaText}>
          {formatDate(dataSelecionada, "EEEE, dd 'de' MMMM")}
        </Text>
        <Text style={styles.totalAgendamentos}>
          {agendamentos.length} agendamento(s) no dia {dataSelecionada.getDate()}
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
    gap: 8,
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
    minWidth: 44,
    minHeight: 64,
    justifyContent: 'center',
    marginHorizontal: 5,
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
  dataText: {
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  dataSugerida: {
    color: COLORS.warning,
    fontStyle: 'italic',
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
  reciboButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
    marginTop: SIZES.sm,
    alignSelf: 'flex-start',
    gap: SIZES.xs / 2,
  },
  reciboButtonText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textInverse,
    fontWeight: '600',
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
  // Estilos faltantes para o calendário
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  navButton: {
    padding: SIZES.sm,
    borderRadius: SIZES.radiusSm,
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
  },
  headerButtonsContainer: {
    flexDirection: 'row',
    gap: SIZES.xs,
  },
  reportButton: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
    gap: SIZES.xs / 2,
  },
  reportButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },
  todayButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
  },
  todayButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },
  sugestaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: SIZES.sm,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusSm,
    marginTop: SIZES.xs,
  },
  sugestaoLabel: {
    fontSize: SIZES.fontXs,
    color: COLORS.warning,
    fontWeight: '600',
    marginRight: SIZES.xs,
  },
  sugestaoValue: {
    fontSize: SIZES.fontXs,
    color: COLORS.warning,
    fontWeight: '600',
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
    backgroundColor: COLORS.warning,
  },
  reportGeneralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reportGeneralButtonText: {
    color: 'white',
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },
});

export default AgendaDentistaScreen;
