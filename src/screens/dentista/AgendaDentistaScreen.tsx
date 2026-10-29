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
  buscarAgendaDentistaMes,
  agendarAgendamento,
  confirmarAgendamento,
  cancelarAgendamento,
  sugerirNovoHorario,
  rejeitarAgendamento,
} from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatDate } from '../../utils/helpers';
import { TIPOS_CONSULTA } from '../../utils/constants';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

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
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [agendamentosMes, setAgendamentosMes] = useState<any[]>([]);
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
    const mesNum = dataSelecionada.getMonth() + 1;
    const mesStr = String(mesNum).padStart(2, '0');
    const diaStr = String(dataSelecionada.getDate()).padStart(2, '0');
    const dataParaBusca = `${ano}-${mesStr}-${diaStr}`;
    
    try {
      const [resultMes, resultDia] = await Promise.all([
        buscarAgendaDentistaMes(profile.id, ano, mesNum),
        buscarAgendaDentista(profile.id, dataParaBusca)
      ]);

      const mesList = resultMes.success && Array.isArray(resultMes.data) ? resultMes.data : [];
      setAgendamentosMes(mesList);

      if (resultDia.success && Array.isArray(resultDia.data)) {
        setAgendamentos(resultDia.data);
        await carregarValoresPlano(resultDia.data);
      } else {
        const doDia = mesList.filter((a: any) => {
          const dOriginal = typeof a.appointment_date === 'string' ? a.appointment_date.slice(0, 10) : '';
          const dSugerida = typeof a.dentist_suggested_date === 'string' ? a.dentist_suggested_date.slice(0, 10) : '';
          return dOriginal === dataParaBusca || dSugerida === dataParaBusca;
        });
        setAgendamentos(doDia);
        await carregarValoresPlano(doDia);
      }
    } catch (e) {
      console.warn('Erro ao carregar agendamentos:', e);
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh({
    enabled: !!profile?.id,
    debounceMs: 700,
    shouldRefresh: (event) => {
      const dentistId = profile?.id;
      if (!dentistId) return false;
      if (event.table !== 'appointments') return false;
      return String(event.new?.dentist_id || event.old?.dentist_id || '') === dentistId;
    },
    refresh: () => {
      void carregarAgendamentos();
    },
  });

  useEffect(() => {
    carregarAgendamentos();
  }, [dataSelecionada, profile?.id]);

  const formatarDia = (diaData: any) => {
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

    const pad = (n: number) => String(n).padStart(2, '0');
    const dataStr = `${dataNormalizada.getFullYear()}-${pad(dataNormalizada.getMonth() + 1)}-${pad(dataNormalizada.getDate())}`;

    // Contar agendamentos neste dia (por appointment_date ou dentist_suggested_date)
    const agendamentosDesteDia = agendamentosMes.filter((a: any) => {
      const dOriginal = typeof a.appointment_date === 'string' ? a.appointment_date.slice(0, 10) : '';
      const dSugerida = typeof a.dentist_suggested_date === 'string' ? a.dentist_suggested_date.slice(0, 10) : '';
      return (dOriginal === dataStr || dSugerida === dataStr) && a.status !== 'cancelado';
    });
    
    return {
      diaSemana: dias[dataNormalizada.getDay()],
      dia: dataNormalizada.getDate(),
      dataStr,
      isHoje: dataNormalizada.getTime() === hoje.getTime(),
      isSelecionado: dataNormalizada.getTime() === selecionada.getTime(),
      isMesAtual: diaData.isMesAtual !== false,
      totalAgendamentos: agendamentosDesteDia.length,
      temUrgencia: agendamentosDesteDia.some((a: any) => a.urgency === 'urgente' || a.urgency === 'emergencia'),
    };
  };

  const selecionarDia = (dia: any) => {
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

  const renderDiaCalendar = ({ item }: any) => {
    const formatacao = formatarDia(item);
    return (
      <TouchableOpacity
        key={`${formatacao.dia}-${formatacao.dataStr}`}
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
        {formatacao.totalAgendamentos > 0 && (
          <View style={[
            styles.badgeDia,
            formatacao.isSelecionado
              ? styles.badgeDiaSelecionado
              : (formatacao.temUrgencia ? styles.badgeDiaUrgente : styles.badgeDiaNormal)
          ]}>
            <Text style={[
              styles.badgeDiaText,
              formatacao.isSelecionado && styles.badgeDiaTextSelecionado
            ]}>
              {formatacao.totalAgendamentos}
            </Text>
          </View>
        )}
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
        a.dentist_id === profile?.id && 
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
      
      // Gerar HTML do relatório no padrão A4 oficial TeOdonto Angola
      const htmlContent = `
        <div class="screen-toolbar no-print">
          <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
          <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
        </div>

        <div class="a4-container">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0284c7; padding-bottom:14px; margin-bottom:18px;">
            <div>
              <div style="font-size:21px; font-weight:800; color:#0369a1; letter-spacing:-0.5px;">🦷 TeOdonto Angola</div>
              <div style="font-size:12.5px; font-weight:700; color:#0f172a; margin-top:3px; text-transform:uppercase;">Relatório Geral de Faturação & Atendimentos</div>
              <div style="font-size:11px; color:#64748b; margin-top:2px;">Médico Dentista: <strong>Dr(a). ${profile?.nome || 'Dentista'}</strong></div>
            </div>
            <div style="text-align:right;">
              <div style="display:inline-block; background:#e0f2fe; color:#0369a1; font-size:10px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">CONSOLIDADO CLÍNICO</div>
              <div style="font-size:10.5px; color:#475569; margin-top:4px;">Emissão: ${formatDate(new Date().toISOString(), 'dd/MM/yyyy HH:mm')}</div>
              <div style="font-size:10px; color:#64748b;">Período: Consultas Realizadas</div>
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:20px; page-break-inside:avoid;">
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#0284c7; font-size:18px; font-weight:800;">${realizadosTodos.length}</div>
              <div style="color:#64748b; font-size:9.5px; text-transform:uppercase; font-weight:700; margin-top:2px;">Atendimentos</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#0284c7; font-size:18px; font-weight:800;">${formatCurrency(totalFaturado)}</div>
              <div style="color:#64748b; font-size:9.5px; text-transform:uppercase; font-weight:700; margin-top:2px;">Total Faturado</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:#16a34a; font-size:18px; font-weight:800;">${formatCurrency(totalRecebido)}</div>
              <div style="color:#64748b; font-size:9.5px; text-transform:uppercase; font-weight:700; margin-top:2px;">Total Recebido</div>
            </div>
            <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; border:1px solid #e2e8f0;">
              <div style="color:${totalPendente > 0 ? '#dc2626' : '#16a34a'}; font-size:18px; font-weight:800;">${formatCurrency(totalPendente)}</div>
              <div style="color:#64748b; font-size:9.5px; text-transform:uppercase; font-weight:700; margin-top:2px;">Saldo Pendente</div>
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
                  <tr style="page-break-inside:avoid;">
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0; font-weight:600; color:#0f172a;">${item.appointment_time || '--:--'}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0;">${item.paciente?.nome || item.patient_name || 'Paciente'}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0;">${TIPOS_CONSULTA[item.tipo]?.label || item.tipo || 'consulta'}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:600;">${formatCurrency(preco)}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0; text-align:right; color:#16a34a; font-weight:700;">${formatCurrency(recebido)}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0; text-align:right; color:${divida > 0 ? '#dc2626' : '#16a34a'}; font-weight:700;">${formatCurrency(divida)}</td>
                    <td style="padding:7px 9px; border-bottom:1px solid #e2e8f0; text-align:center;">
                      <span style="padding:2px 7px; border-radius:4px; font-size:9px; font-weight:700; background:${status === 'pago' ? '#dcfce7' : '#fee2e2'}; color:${status === 'pago' ? '#166534' : '#991b1b'};">
                        ${status === 'pago' ? 'LIQUIDADO' : 'PENDENTE'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('');

              return `
                <div style="margin-bottom:20px;">
                  <div style="font-size:12px; font-weight:700; color:#0284c7; background:#f0f9ff; padding:6px 10px; border-radius:6px; margin-bottom:8px; border-left:4px solid #0284c7;">
                    📅 Sessões de Atendimento — ${data}
                  </div>
                  <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
                    <thead>
                      <tr style="background:#0284c7; color:#ffffff;">
                        <th style="padding:7px 9px; text-align:left; font-size:10px;">Hora</th>
                        <th style="padding:7px 9px; text-align:left; font-size:10px;">Paciente</th>
                        <th style="padding:7px 9px; text-align:left; font-size:10px;">Tipo de Atendimento</th>
                        <th style="padding:7px 9px; text-align:right; font-size:10px;">Total (Kz)</th>
                        <th style="padding:7px 9px; text-align:right; font-size:10px;">Recebido</th>
                        <th style="padding:7px 9px; text-align:right; font-size:10px;">Dívida</th>
                        <th style="padding:7px 9px; text-align:center; font-size:10px;">Status</th>
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
          
          <div style="display:flex; justify-content:space-between; gap:40px; margin-top:36px; page-break-inside:avoid;">
            <div style="flex:1; text-align:center;">
              <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                Dr(a). ${profile?.nome || 'Médico Dentista'}
              </div>
              <div style="font-size:9.5px; color:#64748b;">Corpo Clínico Odontológico</div>
            </div>
            <div style="flex:1; text-align:center;">
              <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                Direcção Administrativa & Financeira
              </div>
              <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola</div>
            </div>
          </div>

          <div style="margin-top:26px; text-align:center; color:#94a3b8; font-size:9px; border-top:1px solid #e2e8f0; padding-top:8px;">
            Documento emitido electronicamente pelo TeOdonto Angola &nbsp;·&nbsp; Válido como comprovativo financeiro oficial
          </div>
        </div>
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
    const dataBase = item.dentist_suggested_date || item.suggested_date || item.appointment_date;
    const isSuggested = !!(item.dentist_suggested_date || item.suggested_date);

    // Extrair hora com segurança: 
    let hora = (item.dentist_suggested_time || item.appointment_time)?.substring(0, 5) || '--:--';
    
    // Se a hora for 00:00 ou padrão, e houver uma string ISO com tempo em dataBase, usa ela
    if ((hora === '--:--' || hora === '00:00') && typeof dataBase === 'string' && dataBase.includes('T')) {
      const timePart = dataBase.split('T')[1]?.substring(0, 5);
      if (timePart) hora = timePart;
    }

    const dataCompleta = formatDate(dataBase) || '--/--/----';
    const isDataSugerida = isSuggested;

    // Obter label do tipo de consulta
    const tipoLabel = TIPOS_CONSULTA[item.tipo]?.label || item.tipo;

    const handleAbrirPaciente = () => {
      if (!item.paciente?.id) return;
      navigation.getParent()?.navigate('PacienteHistorico', {
        pacienteId: item.paciente.id,
        pacienteNome: item.paciente.nome,
      });
    };

    const handleAgendar = async () => {
      if (!profile?.id) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (processingId) return;
      setProcessingId(item.id);
      const res = await agendarAgendamento(item.id, profile?.id);
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
      if (!profile?.id) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (processingId) return;
      setProcessingId(item.id);
      const res = await confirmarAgendamento(item.id, profile?.id);
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
                navigation.getParent()?.navigate('PlanoTratamento', {
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
            navigation.getParent()?.navigate('PlanoTratamento', {
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
      if (!profile?.id) {
        Toast.show({ type: 'error', text1: 'Erro de autenticação', text2: 'Seu perfil ainda não foi carregado. Tente novamente.' });
        return;
      }
      if (!sugestaoAbertaPara) return;
      if (processingId) return;
      setProcessingId(item.id);
      
      try {
        const dataSugerida = item.dentist_suggested_date || item.suggested_date;
        let suggestedTime = item.dentist_suggested_time || item.appointment_time;
        if (typeof dataSugerida === 'string' && dataSugerida.includes('T')) {
          suggestedTime = dataSugerida.split('T')[1].substring(0, 8);
        }

        const dateOnly = typeof dataSugerida === 'string' && dataSugerida.includes('T') ? dataSugerida.split('T')[0] : dataSugerida;

        const { error: updateError } = await supabase
          .from('appointments')
          .update({ 
            appointment_date: dateOnly,
            appointment_time: suggestedTime,
            status: 'confirmado_dentista',
            dentist_id: profile?.id,
            dentist_suggested_date: null,
            dentist_suggested_time: null
          })
          .eq('id', item.id);
          
        if (updateError) {
          throw new Error(updateError.message || 'Erro ao atualizar data');
        }
        
        Toast.show({ 
          type: 'success', 
          text1: 'Agendamento reagendado automaticamente', 
          text2: `Data atualizada para ${formatDate(new Date(dateOnly), "dd/MM/yyyy 'às' HH:mm")} e dentista atribuído` 
        });
        
        // Notify secretary about the automatic assignment
        await notificarSecretarioReagendamento(item);
        
        await carregarAgendamentos();
        setProcessingId(null);
      } catch (error: any) {
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
            dentist_suggested_date: null,
            dentist_suggested_time: null
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
              dentist_id: profile?.id,
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
              dentist_id: profile?.id,
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
      if (!profile?.id) {
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
        const res = await sugerirNovoHorario(item.id, profile?.id, horarioIso.toISOString());
        if (!res.success) {
          const errorMessage = typeof res.error === 'string' ? res.error : res.error?.message || 'Não foi possível sugerir o horário';
          throw new Error(errorMessage);
        }
        
        Toast.show({ 
          type: 'success', 
          text1: 'Horário sugerido com sucesso', 
          text2: `Sugestão enviada para: ${formatDate(horarioIso, "dd/MM/yyyy 'às' HH:mm")}` 
        });
        
        // Notify secretary about the suggestion
        await notificarSecretarioSugestao(item, horarioIso);
        
        setSugestaoAbertaPara(null);
        await carregarAgendamentos();
        setProcessingId(null);
      } catch (error: any) {
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
              dentist_id: profile?.id,
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
        
        const precoProcedimento = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
        const pago = Number(item.valor_pago || 0);
        const restante = precoProcedimento - pago;

        const html = `
          <div class="screen-toolbar no-print">
            <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; Recibo Odontológico</div>
            <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
          </div>

          <div class="a4-container">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0284c7; padding-bottom:14px; margin-bottom:22px;">
              <div>
                <div style="font-size:22px; font-weight:800; color:#0369a1; letter-spacing:-0.5px;">🦷 TeOdonto Angola</div>
                <div style="font-size:13px; font-weight:700; color:#0f172a; margin-top:3px; text-transform:uppercase;">Recibo Oficial de Quitação Odontológica</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Clínica Dentária Especializada &bull; Luanda, Angola</div>
              </div>
              <div style="text-align:right;">
                <div style="display:inline-block; background:#dcfce7; color:#166534; font-size:10px; font-weight:700; padding:4px 10px; border-radius:12px; text-transform:uppercase;">COMPROVATIVO OFICIAL</div>
                <div style="font-size:11px; font-weight:700; color:#0f172a; margin-top:4px;">Nº REC-${String(item.id || '').substring(0, 8).toUpperCase() || '001'}</div>
                <div style="font-size:10.5px; color:#475569;">Data: ${formatDate(new Date().toISOString(), 'dd/MM/yyyy HH:mm')}</div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
                  Identificação do Paciente (Utente)
                </div>
                <div style="font-size:13px; font-weight:700; color:#0f172a;">${item.paciente?.nome || item.patient_name || 'Paciente'}</div>
                <div style="font-size:11px; color:#64748b; margin-top:4px;">Contacto: ${item.paciente?.telefone || 'Não informado'}</div>
              </div>
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="font-size:10.5px; font-weight:700; color:#0284c7; text-transform:uppercase; margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
                  Profissional de Saúde Responsável
                </div>
                <div style="font-size:13px; font-weight:700; color:#0f172a;">Dr(a). ${profile?.nome || 'Dentista'}</div>
                <div style="font-size:11px; color:#64748b; margin-top:4px;">Corpo Clínico Odontológico &bull; TeOdonto Angola</div>
              </div>
            </div>

            <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:11px;">
              <thead>
                <tr style="background:#0284c7; color:#ffffff;">
                  <th style="padding:10px 12px; text-align:left; font-size:10.5px;">Descrição do Procedimento / Consulta</th>
                  <th style="padding:10px 12px; text-align:right; font-size:10.5px; width:130px;">Valor Total</th>
                  <th style="padding:10px 12px; text-align:right; font-size:10.5px; width:130px;">Valor Liquidado</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0;">
                    <div style="font-weight:700; color:#0f172a; font-size:12px;">${TIPOS_CONSULTA[item.tipo]?.label || item.tipo || 'Consulta Odontológica'}</div>
                    <div style="font-size:10.5px; color:#64748b; margin-top:2px;">Atendimento em ${formatDate(item.appointment_date, 'dd/MM/yyyy')} às ${item.appointment_time || '--:--'}</div>
                  </td>
                  <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700;">
                    ${formatCurrency(precoProcedimento)}
                  </td>
                  <td style="padding:14px 12px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:700; color:#16a34a; font-size:12px;">
                    ${formatCurrency(pago)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end; margin-bottom:40px;">
              <div style="width:280px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
                  <span style="color:#64748b;">Total do Serviço:</span>
                  <span style="font-weight:700; color:#0f172a;">${formatCurrency(precoProcedimento)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
                  <span style="color:#16a34a; font-weight:600;">Total Pago:</span>
                  <span style="font-weight:700; color:#16a34a;">${formatCurrency(pago)}</span>
                </div>
                ${restante > 0 ? `
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px;">
                    <span style="color:#dc2626; font-weight:600;">Saldo Pendente:</span>
                    <span style="font-weight:700; color:#dc2626;">${formatCurrency(restante)}</span>
                  </div>
                ` : ''}
                <div style="border-top:2px solid #0284c7; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#0f172a;">Estado:</span>
                  <span style="font-size:10.5px; font-weight:800; color:${restante <= 0 ? '#16a34a' : '#d97706'};">
                    ${restante <= 0 ? 'LIQUIDADO' : 'PARCIALMENTE PAGO'}
                  </span>
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; gap:40px; margin-top:50px; page-break-inside:avoid;">
              <div style="flex:1; text-align:center;">
                <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                  Assinatura do Paciente / Responsável
                </div>
                <div style="font-size:9.5px; color:#64748b;">Declaro ter recebido os serviços discriminados</div>
              </div>
              <div style="flex:1; text-align:center;">
                <div style="border-top:1px solid #475569; margin-bottom:4px; padding-top:4px; font-weight:700; font-size:10.5px;">
                  Assinatura / Carimbo do Caixa
                </div>
                <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola &bull; Departamento Financeiro</div>
              </div>
            </div>

            <div style="margin-top:36px; text-align:center; color:#94a3b8; font-size:9.5px; border-top:1px solid #e2e8f0; padding-top:8px;">
              Agradecemos a sua preferência &bull; TeOdonto Angola &bull; O seu sorriso em primeiro lugar
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
              navigation.getParent()?.navigate('PlanoTratamento', {
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
            {(() => {
              const patientId = item.patient_id || item.paciente?.id;
              const valorPlano = patientId ? planoValores[patientId] : undefined;
              const valorPadrao = PRECO_POR_TIPO[item.tipo || 'consulta'] || 0;
              const valorMostrar = valorPlano ?? valorPadrao;
              return (
                <Text style={styles.valorLabel}>
                  Valor estimado: <Text style={valorPlano ? { color: COLORS.secondary || '#059669', fontWeight: 'bold' } : { color: COLORS.text }}>{formatCurrency(valorMostrar)}{valorPlano ? ' (Plano de Tratamento)' : ''}</Text>
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
          {(item.status === 'confirmado_dentista' || item.status === 'atribuido_dentista' || item.status === 'reagendamento_solicitado') && (
            <View style={{ marginLeft: 16, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{
                fontWeight: 'bold',
                color: item.status === 'confirmado_dentista' ? '#4CAF50' : '#F59E0B',
                fontSize: 12
              }}>
                {item.status === 'confirmado_dentista'
                  ? 'Confirmado'
                  : item.status === 'reagendamento_solicitado'
                  ? 'Reagendando'
                  : 'Atribuído'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]} />
        
        {item.status === 'reagendamento_solicitado' && (
          <View style={styles.sugestaoContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="time-outline" size={16} color="#B45309" />
              <Text style={[styles.sugestaoLabel, { marginLeft: 6, fontWeight: '700' }]}>
                Reagendamento Solicitado:
              </Text>
            </View>

            <Text style={styles.sugestaoValue}>
              {(() => {
                const sDate = item.dentist_suggested_date || item.suggested_date;
                const sTime = item.dentist_suggested_time ? item.dentist_suggested_time.substring(0, 5) : '';
                if (!sDate) return 'Aguardando confirmação do paciente';
                return `${formatDate(sDate)}${sTime ? ' às ' + sTime : ''} (Aguardando paciente)`;
              })()}
            </Text>

            {(item.suggested_date && !item.dentist_suggested_date) && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rescheduleButton, { flex: 1 }]}
                  onPress={handleReagendarSugestao}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.textInverse} />
                  <Text style={styles.actionButtonText}>Aceitar e Reagendar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.danger, flex: 1 }]}
                  onPress={handleRejeitarSugestao}
                  disabled={processingId === item.id}
                >
                  <Ionicons name="close-circle" size={16} color={COLORS.textInverse} />
                  <Text style={styles.actionButtonText}>Rejeitar Data</Text>
                </TouchableOpacity>
              </View>
            )}
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

  // Criar data no formato YYYY-MM-DD sem timezone para comparação correta
  const ano = dataSelecionada.getFullYear();
  const mes = String(dataSelecionada.getMonth() + 1).padStart(2, '0');
  const dia = String(dataSelecionada.getDate()).padStart(2, '0');
  const dataSelecionadaStr = `${ano}-${mes}-${dia}`;
  
  const matchDia = (a: any) => {
    const dOriginal = typeof a.appointment_date === 'string' ? a.appointment_date.slice(0, 10) : '';
    const dSugerida = typeof a.dentist_suggested_date === 'string' ? a.dentist_suggested_date.slice(0, 10) : '';
    return dOriginal === dataSelecionadaStr || dSugerida === dataSelecionadaStr;
  };

  const todosDoDia = [
    ...agendamentos.filter(matchDia),
    ...agendamentosMes.filter((a: any) => matchDia(a) && !agendamentos.some((ag: any) => ag.id === a.id))
  ];

  const meusAgendadosDoDia = todosDoDia.filter(
    (a) =>
      a.dentist_id === profile?.id &&
      ['atribuido_dentista', 'pendente', 'agendado', 'solicitado', 'agendamento_pendente_secretaria', 'reagendamento_solicitado'].includes(a.status)
  );
  const meusConfirmadosDoDia = todosDoDia.filter(
    (a) =>
      a.dentist_id === profile?.id &&
      ['confirmado_dentista', 'confirmado_paciente', 'notificado_paciente'].includes(a.status)
  );
  const realizadosDoDia = todosDoDia.filter(
    (a) =>
      a.dentist_id === profile?.id &&
      a.status === 'realizado'
  );
  const canceladosDoDia = todosDoDia.filter(
    (a) => 
      ['cancelado', 'rejeitado_dentista'].includes(a.status) && 
      (!a.dentist_id || a.dentist_id === profile?.id)
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
          {todosDoDia.length} agendamento(s) no dia {dataSelecionada.getDate()}
        </Text>
      </View>

      {/* Lista de Agendamentos */}
      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : todosDoDia.length === 0 ? (
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
  badgeDia: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  badgeDiaNormal: {
    backgroundColor: '#10B981',
  },
  badgeDiaUrgente: {
    backgroundColor: COLORS.danger,
  },
  badgeDiaSelecionado: {
    backgroundColor: '#FFFFFF',
  },
  badgeDiaText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  badgeDiaTextSelecionado: {
    color: COLORS.primary,
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
