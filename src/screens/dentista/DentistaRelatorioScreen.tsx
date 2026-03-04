import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { buscarTodosAgendamentosDentista } from '../../services/agendamentoService';
import Loading from '../../components/ui/Loading';

const DentistaRelatorioScreen: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState<boolean>(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    if (!profile?.id) return;
    
    // Busca todos os agendamentos (sem filtro de data)
    const result = await buscarTodosAgendamentosDentista(profile.id);
    if (result.success) {
      setAgendamentos(result.data || []);
    }
    setLoading(false);
  };

  const getDateRange = (type: 'dia' | 'semana' | 'mes') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (type) {
      case 'dia':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'semana':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'mes':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return { startDate, endDate };
  };

  const filtrarAgendamentos = (type: 'dia' | 'semana' | 'mes') => {
    const { startDate, endDate } = getDateRange(type);
    
    return agendamentos.filter(ag => {
      const dataAgendamento = new Date(ag.data_agendamento);
      return dataAgendamento >= startDate && dataAgendamento <= endDate;
    });
  };

  const gerarHtmlRelatorio = (agendamentosFiltrados: any[], tipo: string, periodo: string): string => {
    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const total = agendamentosFiltrados.length;
    const agendados = agendamentosFiltrados.filter(a => a.status === 'agendado').length;
    const confirmados = agendamentosFiltrados.filter(a => a.status === 'confirmado').length;
    const pendentes = agendamentosFiltrados.filter(a => a.status === 'pendente').length;
    const cancelados = agendamentosFiltrados.filter(a => a.status === 'cancelado').length;
    const realizados = agendamentosFiltrados.filter(a => a.status === 'realizado').length;

    const rows = agendamentosFiltrados
      .map(ag => {
        let statusLabel = ag.status || '-';
        if (statusLabel === 'confirmado') statusLabel = 'Confirmado';
        else if (statusLabel === 'pendente') statusLabel = 'Pendente';
        else if (statusLabel === 'agendado') statusLabel = 'Agendado';
        else if (statusLabel === 'cancelado') statusLabel = 'Cancelado';
        else if (statusLabel === 'realizado') statusLabel = 'Realizado';
        
        return `
        <tr>
          <td>${ag.id ? ag.id.substring(0, 4) : '-'}</td>
          <td>${new Date(ag.data_agendamento).toLocaleDateString('pt-BR')}</td>
          <td>${new Date(ag.data_agendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${ag.paciente?.nome || '-'}</td>
          <td>${ag.tipo || 'Consulta'}</td>
          <td><span class="status ${ag.status}">${statusLabel}</span></td>
        </tr>`;
      })
      .join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1E88E5; padding-bottom: 15px; }
        .logo { font-size: 24px; font-weight: bold; color: #1E88E5; }
        .subtitle { color: #666; margin-top: 5px; }
        .period { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 15px 0; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
        .kpi { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
        .kpi-value { font-size: 24px; font-weight: bold; color: #1E88E5; }
        .kpi-label { font-size: 12px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
        th { background: #1E88E5; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status { padding: 2px 5px; border-radius: 3px; font-size: 8px; }
        .status.confirmado { background: #4CAF50; color: white; }
        .status.pendente { background: #FF9800; color: white; }
        .status.agendado { background: #2196F3; color: white; }
        .status.cancelado { background: #F44336; color: white; }
        .status.realizado { background: #9C27B0; color: white; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🦷 TeOdonto Angola</div>
        <div class="subtitle">Sistema de Gestão de Consultas Odontológicas</div>
      </div>
      
      <div class="period">
        <strong>${periodo}</strong><br>
        Gerado em: ${dataGeracao}
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi-value">${total}</div>
          <div class="kpi-label">Total de Consultas</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${agendados}</div>
          <div class="kpi-label">Agendados</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${confirmados}</div>
          <div class="kpi-label">Confirmados</div>
        </div>
        <div class="kpi">
          <div class="kpi-value">${pendentes}</div>
          <div class="kpi-label">Pendentes</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Data</th>
            <th>Hora</th>
            <th>Paciente</th>
            <th>Tipo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="text-align:center;">Nenhum agendamento encontrado</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <p>Este relatório foi gerado automaticamente pelo sistema TeOdonto Angola</p>
      </div>
    </body>
    </html>`;
  };

  const gerarPdf = async (type: 'dia' | 'semana' | 'mes') => {
    setGerandoPdf(true);
    
    try {
      // Usa todos os agendamentos (sem filtro de data)
      const filtrados = agendamentos;
      
      const periodo = type === 'dia' 
        ? 'Relatório do Dia' 
        : type === 'semana' 
          ? 'Relatório Semanal' 
          : 'Relatório Mensal';
      
      const html = gerarHtmlRelatorio(filtrados, type, periodo);
      
      // Try to generate PDF using expo-print
      try {
        const Print = require('expo-print');
        const Sharing = require('expo-sharing');
        
        const { uri } = await Print.printToFileAsync({ html });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf',
          });
          Alert.alert('Sucesso', 'PDF gerado e pronto para compartilhar!');
        } else {
          Alert.alert('PDF Gerado', `O arquivo foi salvo em: ${uri}`);
        }
      } catch (printError) {
        // Fallback: show the report on screen
        const tipoLabel = type === 'dia' ? 'do Dia' : type === 'semana' ? 'da Semana' : 'do Mês';
        
        let message = `Total: ${filtrados.length} consultas\n\n`;
        message += `Confirmados: ${filtrados.filter(a => a.status === 'confirmado').length}\n`;
        message += `Pendentes: ${filtrados.filter(a => a.status === 'pendente').length}\n`;
        message += `Agendados: ${filtrados.filter(a => a.status === 'agendado').length}\n\n`;
        
        if (filtrados.length > 0) {
          message += 'Primeiros agendamentos:\n';
          filtrados.slice(0, 5).forEach((ag, i) => {
            message += `${i + 1}. ${ag.paciente?.nome || 'Paciente'} - ${new Date(ag.data_agendamento).toLocaleDateString('pt-BR')} - ${ag.status}\n`;
          });
        }
        
        Alert.alert(`Relatório ${tipoLabel}`, message);
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao gerar relatório');
    } finally {
      setGerandoPdf(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="document-text" size={32} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Relatórios</Text>
        <Text style={styles.headerSubtitle}>
          Gere relatórios das suas consultas
        </Text>
      </View>

      {gerandoPdf && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Gerando relatório...</Text>
        </View>
      )}

      <View style={styles.cardsContainer}>
        {/* Relatório do Dia */}
        <TouchableOpacity 
          style={styles.card}
          onPress={() => gerarPdf('dia')}
          activeOpacity={0.7}
          disabled={gerandoPdf}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="today" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Relatório do Dia</Text>
          <Text style={styles.cardDescription}>
            Consultas realizadas hoje
          </Text>
          <View style={styles.cardFooter}>
            <Ionicons name="print" size={16} color={COLORS.textSecondary} />
            <Text style={styles.cardFooterText}>Gerar PDF</Text>
          </View>
        </TouchableOpacity>

        {/* Relatório da Semana */}
        <TouchableOpacity 
          style={styles.card}
          onPress={() => gerarPdf('semana')}
          activeOpacity={0.7}
          disabled={gerandoPdf}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="calendar" size={28} color={COLORS.secondary} />
          </View>
          <Text style={styles.cardTitle}>Relatório da Semana</Text>
          <Text style={styles.cardDescription}>
            Consultas dos últimos 7 dias
          </Text>
          <View style={styles.cardFooter}>
            <Ionicons name="print" size={16} color={COLORS.textSecondary} />
            <Text style={styles.cardFooterText}>Gerar PDF</Text>
          </View>
        </TouchableOpacity>

        {/* Relatório do Mês */}
        <TouchableOpacity 
          style={styles.card}
          onPress={() => gerarPdf('mes')}
          activeOpacity={0.7}
          disabled={gerandoPdf}
        >
          <View style={styles.cardIcon}>
            <Ionicons name="calendar-outline" size={28} color={COLORS.accent} />
          </View>
          <Text style={styles.cardTitle}>Relatório do Mês</Text>
          <Text style={styles.cardDescription}>
            Consultas do mês atual
          </Text>
          <View style={styles.cardFooter}>
            <Ionicons name="print" size={16} color={COLORS.textSecondary} />
            <Text style={styles.cardFooterText}>Gerar PDF</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Resumo */}
      <View style={styles.resumoContainer}>
        <Text style={styles.resumoTitle}>Resumo Total</Text>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Total :</Text>
          <Text style={styles.resumoValue}>
            {agendamentos.filter(a => a.status === 'agendado').length + 
             agendamentos.filter(a => a.status === 'confirmado').length + 
             agendamentos.filter(a => a.status === 'pendente').length + 
             agendamentos.filter(a => a.status === 'realizado').length + 
             agendamentos.filter(a => a.status === 'cancelado').length}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Agendados:</Text>
          <Text style={styles.resumoValueAgendado}>
            {agendamentos.filter(a => a.status === 'agendado').length}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Confirmados:</Text>
          <Text style={styles.resumoValueConfirmado}>
            {agendamentos.filter(a => a.status === 'confirmado').length}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Realizados:</Text>
          <Text style={styles.resumoValue}>
            {agendamentos.filter(a => a.status === 'realizado').length}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Pendentes:</Text>
          <Text style={styles.resumoValuePendente}>
            {agendamentos.filter(a => a.status === 'pendente').length}
          </Text>
        </View>
        <View style={styles.resumoRow}>
          <Text style={styles.resumoLabel}>Cancelados:</Text>
          <Text style={[styles.resumoValue, { color: '#F44336' }]}>
            {agendamentos.filter(a => a.status === 'cancelado').length}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
    paddingVertical: SIZES.lg,
  },
  headerTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SIZES.sm,
  },
  headerSubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  loadingText: {
    marginTop: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cardsContainer: {
    gap: SIZES.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.lg,
    marginBottom: SIZES.md,
    ...SHADOWS.sm,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  cardTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  cardDescription: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SIZES.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  cardFooterText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.xs,
  },
  resumoContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.lg,
    marginTop: SIZES.lg,
    ...SHADOWS.sm,
  },
  resumoTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
  },
  resumoLabel: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
  },
  resumoValue: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  resumoValueConfirmado: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  resumoValuePendente: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  resumoValueAgendado: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: '#2196F3',
  },
});

export default DentistaRelatorioScreen;

