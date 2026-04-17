/**
 * Servico de Relatorios
 * Gera relatorios de dentistas e triagens
 */

import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, getAdminClient } from '../config/supabase';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
import { DentistaProfile } from './dentistaService';

export interface RelatorioDentista {
  dentista: DentistaProfile;
  totalTriagens: number;
  triagensRespondidas: number;
  triagensPendentes: number;
  percentualResposta: number;
  dataUltimaAtividade: string | null;
  // Billing data
  totalFaturado?: number;
  totalRecebido?: number;
  pendenteReceber?: number;
  totalProcedimentos?: number;
  taxaFaltas?: number;
}

export interface RelatorioGeral {
  totalDentistas: number;
  totalPacientes: number;
  dentistasAtivos: number;
  totalTriagens: number;
  totalConsultas?: number;
  totalMensagens?: number;
  totalSecretarios?: number;
  
  // Financial metrics from procedimentos_tratamento
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  totalProcedimentos: number;

  // Legacy/Estimated metrics
  receitaEstimada?: number;
  receitaRealizada?: number;
  
  triagensRespondidas: number;
  percentualResposta: number;
  
  // novos campos para resumo do mês atual
  cadastrosMes?: number;
  dentistasMes?: number;
  pacientesMes?: number;
  secretariosMes?: number;
  
  receitaHoje?: number;
  receitaSemana?: number;
  pacientesHoje?: number;
  pacientesSemana?: number;
  aguardandoFatura?: number;
  taxaFaltas?: number;
  
  dentistas: RelatorioDentista[];
  secretarios: any[];
  dataGeracao: string;
}

export interface ExportResult {
  success: boolean;
  fileUri?: string;
  error?: string;
}

/**
 * Busca itens financeiros detalhados para um dentista especifico.
 * Agrega dados de agendamentos realizados E procedimentos de planos de tratamento.
 */
export const buscarTratamentosFinanceirosDentista = async (
  dentistaId: string, 
  options: { limit?: number; startDate?: string; endDate?: string } = {}
) => {
  try {
    const { limit, startDate, endDate } = options;
    
    const client = getAdminClient() || supabase;
    
    // ─── 1. Agendamentos deste dentista ───────────────────
    let agQuery = client
      .from('appointments')
      .select('id, appointment_date, appointment_time, symptoms, status, valor_pago, patient_id, paciente:profiles!patient_id(nome)')
      .eq('dentist_id', dentistaId)
      .in('status', ['realizado', 'confirmado_dentista', 'confirmado_paciente', 'atribuido_dentista']);

    if (startDate) agQuery = agQuery.gte('appointment_date', startDate);
    if (endDate) agQuery = agQuery.lte('appointment_date', endDate);
    if (limit) agQuery = agQuery.limit(limit);

    const { data: agendamentos } = await agQuery.order('appointment_date', { ascending: false });

    const PRECO_LOCAL: Record<string, number> = {
      consulta: 25000, avaliacao: 30000, retorno: 15000, urgencia: 45000,
      raio_x: 20000, panoramico: 35000, profilaxia: 22000, branqueamento: 60000,
      canal: 90000, ortodontia: 120000, restauracao: 40000,
    };

    const agItems = (agendamentos || []).map((a: any) => {
      const valorTotal = PRECO_LOCAL[a.symptoms || a.tipo || 'consulta'] || 0;
      const valorPago = Number(a.valor_pago || 0);
      const pacienteNome = Array.isArray(a.paciente) ? (a.paciente as any)[0]?.nome : (a.paciente as any)?.nome || 'Paciente';
      return {
        id: a.id,
        paciente_nome: pacienteNome,
        procedimento: TIPOS_LABEL[a.symptoms || a.tipo || 'consulta'] || a.symptoms || a.tipo || 'Consulta',
        descricao: TIPOS_LABEL[a.symptoms || a.tipo || 'consulta'] || 'Consulta',
        valor: valorTotal,
        valor_pago: valorPago,
        status_financeiro: valorPago >= valorTotal ? 'pago' : valorPago > 0 ? 'parcial' : 'pendente',
        updated_at: a.appointment_date,
        created_at: a.appointment_date,
        _source: 'appointment',
      };
    });

    // ─── 2. Procedimentos (Busca Manual Segura) ───────────────────
    
    // 1. Buscar planos de tratamento do dentista
    const { data: planos, error: planosError } = await client
      .from('planos_tratamento')
      .select('id, paciente_id, paciente:profiles!paciente_id(nome)')
      .eq('dentista_id', dentistaId);

    const planoIds = (planos || []).map(p => p.id);
    let procItems: any[] = [];

    // 2. Buscar procedimentos vinculados a esses planos
    const { data: procs, error: procError } = await client
      .from('procedimentos_tratamento')
      .select('*')
      .in('plano_id', planoIds)
      .order('created_at', { ascending: false });

      if (procError) console.warn('Erro proc:', procError);

      if (procs && procs.length > 0) {
        const planosMap = Object.fromEntries((planos || []).map(p => [p.id, p]));
        
        procItems = procs.map((p: any) => {
          const plano = planosMap[p.plano_id];
          const pacienteNome = (plano?.paciente as any)?.nome || 'Paciente';
          
          const valorTotal = Number(p.valor || 0);
          const valorPago = Number(p.valor_pago !== undefined && p.valor_pago !== null
            ? p.valor_pago
            : p.status_financeiro === 'pago' ? valorTotal : 0);

          return {
            ...p,
            paciente_nome: pacienteNome,
            valor: valorTotal,
            valor_pago: valorPago,
            status_financeiro: valorPago >= valorTotal ? 'pago' : valorPago > 0 ? 'parcial' : 'pendente',
            _source: 'plano',
            appointment_date: p.appointment_date || p.data_procedimento,
          };
        });
      }

    // ─── 3. Merge: combinar ambos para um relatório completo ───────
    const result = [...agItems, ...procItems].sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || a.appointment_date || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || b.appointment_date || 0).getTime();
      return dateB - dateA;
    });

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

const TIPOS_LABEL: Record<string, string> = {
  consulta: 'Consulta de rotina', avaliacao: 'Consulta de avaliação', retorno: 'Consulta de retorno',
  urgencia: 'Urgência', raio_x: 'Raio-X', panoramico: 'Panorâmico',
  profilaxia: 'Profilaxia', branqueamento: 'Branqueamento', canal: 'Tratamento de canal',
  ortodontia: 'Ortodontia', restauracao: 'Restauração',
};

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

/**
 * Gera relatorio geral de todos os dentistas
 */
export const gerarRelatorioGeral = async (): Promise<{
  success: boolean;
  data?: RelatorioGeral;
  error?: string;
}> => {
  try {
    const client = getAdminClient() || supabase;

    // 1. Chamar RPC otimizada para estatísticas globais (Bypassa RLS e reduz latência)
    const { data: rpcStats, error: rpcError } = await client.rpc('admin_report_stats');

    if (rpcError) {
      console.error('Erro na RPC admin_report_stats:', rpcError);
      // Fallback ou erro
      return { success: false, error: rpcError.message };
    }

    const stats = Array.isArray(rpcStats) ? rpcStats[0] : rpcStats;

    // 2. Buscar listagem para detalhamento
    const [dentistasRes, triagensRes, appointmentsRes, secretariosRes] = await Promise.all([
      client.from('profiles').select('id, nome, email, especialidade, crm, created_at').eq('tipo', 'dentista').order('nome', { ascending: true }),
      client.from('triagens').select('dentista_id, status, updated_at'),
      client.from('appointments').select('symptoms,status,appointment_date,id,dentist_id'),
      client.from('profiles').select('id, nome, email, created_at').eq('tipo', 'secretario').order('nome', { ascending: true }),
    ]);

    if (dentistasRes.error) return { success: false, error: dentistasRes.error.message };
    
    const dentistas = dentistasRes.data || [];
    const triagens = triagensRes.data || [];
    const agendamentosReceita = appointmentsRes.data || [];
    const secretarios = secretariosRes.data || [];
    const billingByDentist: Record<string, { faturado: number, recebido: number, procedimentos: number, valorTotal: number }> = {};
    const appointmentsByDentist: Record<string, { total: number, faltas: number }> = {};
    let totalAppointmentsGlobal = 0;
    let totalFaltasGlobal = 0;

    // Detalhes financeiros por dentista (opcional se a RPC já der o global, mas bom para as rows extras)
    const { data: procedimentos } = await client.from('procedimentos_tratamento').select('*, plano:planos_tratamento(dentista_id)');
    
    (procedimentos || []).forEach((p: any) => {
      const dId = p.plano?.dentista_id;
      const valor = Number(p.valor || 0);
      const isPago = p.status_financeiro === 'pago';
      const valorPago = Number(p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : (isPago ? valor : 0));
      
      if (dId) {
        if (!billingByDentist[dId]) billingByDentist[dId] = { faturado: 0, recebido: 0, procedimentos: 0, valorTotal: 0 };
        billingByDentist[dId].valorTotal += valor;
        billingByDentist[dId].faturado += valorPago;
        billingByDentist[dId].recebido += valorPago;
        billingByDentist[dId].procedimentos += 1;
      }
    });

    (agendamentosReceita || []).forEach((agenda: any) => {
      const dId = agenda.dentist_id;
      const status = (agenda.status || '').toLowerCase();
      if (!dId) return;
      if (!appointmentsByDentist[dId]) appointmentsByDentist[dId] = { total: 0, faltas: 0 };
      if (['realizado', 'cancelado'].includes(status)) {
        appointmentsByDentist[dId].total++;
        totalAppointmentsGlobal++;
        if (status === 'cancelado') {
          appointmentsByDentist[dId].faltas++;
          totalFaltasGlobal++;
        }
      }
    });

    const relatoriosDentistas: RelatorioDentista[] = (dentistas || []).map((dentista: any) => {
      const triagensDentista = (triagens || []).filter((t: any) => t.dentista_id === dentista.id);
      const respondidas = triagensDentista.filter((t: any) => t.status === 'respondido' || t.status === 'completo');
      const billing = billingByDentist[dentista.id] || { faturado: 0, recebido: 0, procedimentos: 0, valorTotal: 0 };
      const appts = appointmentsByDentist[dentista.id] || { total: 0, faltas: 0 };
      
      return {
        dentista: dentista as DentistaProfile,
        totalTriagens: triagensDentista.length,
        triagensRespondidas: respondidas.length,
        triagensPendentes: triagensDentista.length - respondidas.length,
        percentualResposta: triagensDentista.length > 0 ? Math.round((respondidas.length / triagensDentista.length) * 100) : 0,
        dataUltimaAtividade: triagensDentista.length > 0 ? new Date(Math.max(...triagensDentista.map((t: any) => new Date(t.updated_at).getTime()))).toISOString() : null,
        totalFaturado: billing.faturado,
        totalRecebido: billing.recebido,
        pendenteReceber: billing.valorTotal - billing.recebido,
        totalProcedimentos: billing.procedimentos,
        taxaFaltas: appts.total > 0 ? Math.round((appts.faltas / appts.total) * 100) : 0,
      };
    });

    const relatorio: RelatorioGeral = {
      totalDentistas: Number(stats.total_dentistas || 0),
      totalPacientes: Number(stats.total_pacientes || 0),
      dentistasAtivos: relatoriosDentistas.filter((r) => r.totalTriagens > 0 || (r.totalProcedimentos || 0) > 0).length,
      totalTriagens: (triagens || []).length,
      totalConsultas: Number(stats.total_consultas || 0),
      totalMensagens: Number(stats.total_mensagens || 0),
      totalSecretarios: Number(stats.total_secretarios || 0),
      totalFaturado: Number(stats.receita_realizada || 0), // Baseado na regra anterior
      totalRecebido: Number(stats.receita_realizada || 0),
      totalPendente: Number(stats.receita_estimada || 0) - Number(stats.receita_realizada || 0),
      totalProcedimentos: (procedimentos || []).length,
      receitaEstimada: Number(stats.receita_estimada || 0),
      receitaRealizada: Number(stats.receita_realizada || 0),
      triagensRespondidas: (triagens || []).filter((t: any) => t.status === 'respondido' || t.status === 'completo').length,
      percentualResposta: (triagens || []).length > 0 ? ((triagens || []).filter((t: any) => t.status === 'respondido' || t.status === 'completo').length / (triagens || []).length) * 100 : 0,
      
      dentistasMes: Number(stats.dentistas_mes || 0),
      pacientesMes: Number(stats.pacientes_mes || 0),
      secretariosMes: Number(stats.secretarios_mes || 0),
      
      dentistas: relatoriosDentistas,
      secretarios: secretarios,
      dataGeracao: new Date().toISOString(),
    };

    return { success: true, data: relatorio };
  } catch (error: any) {
    console.error('gerarRelatorioGeral error:', error);
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatorio',
    };
  }
};

/**
 * Gera HTML para relatorio de faturamento de um dentista
 */
export const buildDentistBillingHtml = (dentistName: string, items: any[], issuedByName?: string): string => {
  const isSelfService = issuedByName === dentistName;
  // totalValor = soma dos preços nominais de todos os procedimentos
  const totalValor = items.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  // totalPago = soma de tudo que foi efectivamente pago (valor_pago)
  const totalPago = items.reduce((sum, item) => {
    const vPago = (item.valor_pago !== undefined && item.valor_pago !== null)
      ? item.valor_pago
      : (item.status_financeiro === 'pago' ? item.valor : 0);
    return sum + Number(vPago || 0);
  }, 0);
  // Pendente = o que ainda não foi pago
  const pendente = totalValor - totalPago;

  return `
    <!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Faturação</title>
      <style>
        @page { 
          margin: 10mm; 
        }
        @media print {
          * { -webkit-print-color-adjust: exact; }
          body { margin: 0; }
        }
        * { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        body { padding: 40px; background: white; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #7C3AED; padding-bottom: 20px; }
        h1 { color: #7C3AED; font-size: 28px; }
        .subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }
        .summary { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 40px; }
        .summary-card { flex: 1; background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card h3 { color: #7C3AED; font-size: 22px; margin-bottom: 4px; }
        .summary-card p { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        table th { background: #7C3AED; color: white; padding: 12px; text-align: left; font-size: 12px; }
        table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .status-pago { background: #dcfce7; color: #166534; }
        .status-parcial { background: #fef9c3; color: #854d0e; }
        .status-pendente { background: #fee2e2; color: #991b1b; }
        .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sorriso Digital</h1>
        <p class="subtitle">Relatório Individual de Faturação</p>
        <p class="subtitle"><strong>Dr(a). ${dentistName}</strong></p>
        <p class="subtitle" style="margin-top: 10px; font-size: 11px; color: #7C3AED;">
          ${issuedByName ? `Emitido por: ${issuedByName}` : ""}
          ${issuedByName && !isSelfService ? ` | Para: Dr(a). ${dentistName}` : ""}
        </p>
        <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-AO')}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <h3>${formatMoney(totalPago)}</h3>
          <p>Total Faturado</p>
        </div>
        <div class="summary-card">
          <h3>${formatMoney(totalPago)}</h3>
          <p>Total Recebido</p>
        </div>
        <div class="summary-card">
          <h3 style="color: ${pendente > 0 ? '#b91c1c' : '#16a34a'}">${formatMoney(pendente)}</h3>
          <p>Pendente</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Paciente</th>
            <th>Procedimento</th>
            <th>Valor Total</th>
            <th>Valor Pago</th>
            <th>Dívida</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const vTotal = Number(item.valor || 0);
            const vPago = Number((item.valor_pago !== undefined && item.valor_pago !== null)
              ? item.valor_pago
              : (item.status_financeiro === 'pago' ? vTotal : 0));
            const divida = vTotal - vPago;
            const statusFin = item.status_financeiro || (vPago >= vTotal ? 'pago' : vPago > 0 ? 'parcial' : 'pendente');
            const dataRef = item.appointment_date || item.updated_at || item.created_at;
            const dataStr = dataRef
              ? (typeof dataRef === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataRef) 
                  ? dataRef.split('-').reverse().join('/') 
                  : new Date(dataRef).toLocaleDateString('pt-AO'))
              : '---';
            const nomeProcedimento = item.procedimento || item.descricao || item.nome || 'Procedimento';
            const statusLabel = statusFin === 'pago' ? 'PAGO' : statusFin === 'parcial' ? 'PARCIAL' : 'PENDENTE';
            const statusClass = statusFin === 'pago' ? 'status-pago' : statusFin === 'parcial' ? 'status-parcial' : 'status-pendente';
            return `
              <tr>
                <td>${dataStr}</td>
                <td>${item.paciente_nome || 'Paciente'}</td>
                <td>${nomeProcedimento}</td>
                <td>${formatMoney(vTotal)}</td>
                <td style="color:#16a34a;font-weight:bold">${formatMoney(vPago)}</td>
                <td style="color:${divida > 0 ? '#b91c1c' : '#16a34a'}">${formatMoney(divida)}</td>
                <td><span class="status ${statusClass}">${statusLabel}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Sorriso Digital - Sistema de Gestão Odontológica</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Gera relatório detalhado de um dentista especifico
 */
export const gerarRelatorioDentista = async (
  dentistaId: string
): Promise<{
  success: boolean;
  data?: {
    dentista: DentistaProfile;
    estatisticas: RelatorioDentista;
    triagens: any[];
  };
  error?: string;
}> => {
  try {
    const { data: dentista, error: dentistaError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', dentistaId)
      .single();

    if (dentistaError) {
      return { success: false, error: 'Dentista nao encontrado' };
    }

    let triagens: any[] = [];
    const tryByDentistaId = await supabase
      .from('triagens')
      .select('*')
      .eq('dentista_id', dentistaId)
      .order('created_at', { ascending: false });

    if (!tryByDentistaId.error) {
      triagens = (tryByDentistaId.data || []) as any[];
    } else {
      const tryByProfileId = await supabase
        .from('triagens')
        .select('*')
        .eq('profile_id', dentistaId)
        .order('created_at', { ascending: false });

      if (tryByProfileId.error) {
        return { success: false, error: tryByProfileId.error.message };
      }

      triagens = (tryByProfileId.data || []) as any[];
    }

    const respondidas = triagens.filter(
      (t: any) => t.status === 'respondido' || t.status === 'completo'
    );
    const pendentes = triagens.filter((t: any) => t.status === 'pendente');
    const percentual =
      triagens.length > 0 ? (respondidas.length / triagens.length) * 100 : 0;

    const { data: planosIdsRes } = await supabase
      .from('planos_tratamento')
      .select('id')
      .eq('dentista_id', dentistaId);
    
    const planoIds = (planosIdsRes || []).map((p: any) => p.id);
    let billing = { faturado: 0, recebido: 0, procedimentos: 0, pendente: 0 };
    
    if (planoIds.length > 0) {
      const { data: procs } = await supabase
        .from('procedimentos_tratamento')
        .select('valor, status_financeiro, valor_pago')
        .in('plano_id', planoIds);
      
      let totalValorDescrito = 0;
      (procs || []).forEach((p: any) => {
        const valor = Number(p.valor || 0);
        const valorPago = Number(p.valor_pago !== undefined && p.valor_pago !== null ? p.valor_pago : (p.status_financeiro === 'pago' ? valor : 0));
        totalValorDescrito += valor;
        billing.faturado += valor;
        billing.recebido += valorPago;
        billing.procedimentos += 1;
      });
      billing.pendente = totalValorDescrito - billing.recebido;
    }

    const estatisticas: RelatorioDentista = {
      dentista: dentista as DentistaProfile,
      totalTriagens: triagens.length,
      triagensRespondidas: respondidas.length,
      triagensPendentes: pendentes.length,
      percentualResposta: Math.round(percentual),
      dataUltimaAtividade: triagens.length > 0 ? triagens[0].updated_at : null,
      totalFaturado: billing.faturado,
      totalRecebido: billing.recebido,
      pendenteReceber: billing.pendente || 0,
      totalProcedimentos: billing.procedimentos,
    };

    return {
      success: true,
      data: {
        dentista: dentista as DentistaProfile,
        estatisticas,
        triagens,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatorio',
    };
  }
};


const buildCsv = (relatorio: RelatorioGeral): string => {
  let csv = 'Relatorio Geral de Dentistas\n';
  csv += `Gerado em: ${new Date(relatorio.dataGeracao).toLocaleDateString('pt-AO')}\n\n`;
  csv += `Total de Dentistas,${relatorio.totalDentistas}\n`;
  csv += `Total de Pacientes,${relatorio.totalPacientes}\n`;
  csv += `Dentistas Ativos,${relatorio.dentistasAtivos}\n`;
  csv += `Total de Triagens,${relatorio.totalTriagens}\n`;
  csv += `Triagens Respondidas,${relatorio.triagensRespondidas}\n`;
  csv += `Percentual de Resposta,${relatorio.percentualResposta}%\n\n`;

  csv += 'Nome,Especialidade,Total Triagens,Respondidas,Pendentes,Taxa Resposta (%)\n';
  relatorio.dentistas.forEach((r) => {
    csv += `"${r.dentista.nome || ''}","${r.dentista.especialidade || ''}",${r.totalTriagens},${r.triagensRespondidas},${r.triagensPendentes},${r.percentualResposta}\n`;
  });

  return csv;
};

const saveAndShareNative = async (
  content: string,
  filename: string,
  mimeLabel: string
): Promise<ExportResult> => {
  try {
    if (!FileSystem.documentDirectory) {
      return { success: false, error: 'Diretorio local indisponivel no dispositivo' };
    }

    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Share.share({
      title: `Exportar ${mimeLabel}`,
      message: `Arquivo gerado: ${filename}\n${fileUri}`,
      url: fileUri,
    });

    return { success: true, fileUri };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || `Erro ao exportar ${mimeLabel}`,
    };
  }
};

/**
 * Exporta relatorio em formato JSON
 */
export const exportarRelatorioJSON = async (
  relatorio: RelatorioGeral | any,
  filename: string = 'relatorio.json'
): Promise<ExportResult> => {
  try {
    const dataStr = JSON.stringify(relatorio, null, 2);

    if (Platform.OS === 'web') {
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }

    return await saveAndShareNative(dataStr, filename, 'JSON');
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao exportar JSON' };
  }
};

/**
 * Exporta relatorio em formato CSV
 */
export const exportarRelatorioCSV = async (
  relatorio: RelatorioGeral,
  filename: string = 'relatorio.csv'
): Promise<ExportResult> => {
  try {
    const csv = buildCsv(relatorio);

    if (Platform.OS === 'web') {
      const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return { success: true };
    }

    return await saveAndShareNative(csv, filename, 'CSV');
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao exportar CSV' };
  }
};

/**
 * Prepara HTML para impressao do relatorio
 */
export const gerarHTMLRelatorio = (relatorio: RelatorioGeral): string => {
  const dataBR = new Date(relatorio.dataGeracao).toLocaleDateString('pt-AO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8">
      <title>Relatorio Geral - Te Odonto Angola</title>
      <style>
        * { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        body { padding: 40px; background: white; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1E88E5; padding-bottom: 20px; }
        h1 { color: #1E88E5; font-size: 28px; }
        .subtitle { color: #666; font-size: 12px; margin-top: 5px; }
        .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { color: #1E88E5; font-size: 24px; }
        .summary-card p { color: #666; font-size: 12px; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        table th { background: #1E88E5; color: white; padding: 12px; text-align: left; font-weight: bold; }
        table td { padding: 12px; border-bottom: 1px solid #eee; }
        table tr:nth-child(even) { background: #f9f9f9; }
        .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Te Odonto Angola</h1>
        <p class="subtitle">Relatorio Geral de Dentistas</p>
        <p class="subtitle">Gerado em ${dataBR}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <h3>${relatorio.totalDentistas}</h3>
          <p>Total de Dentistas</p>
        </div>
        <div class="summary-card">
          <h3>${relatorio.dentistasMes || 0}</h3>
          <p>Dentistas mês</p>
        </div>
        <div class="summary-card">
          <h3>${relatorio.pacientesMes || 0}</h3>
          <p>Pacientes mês</p>
        </div>
        <div class="summary-card">
          <h3>${relatorio.dentistasAtivos}</h3>
          <p>Dentistas Ativos</p>
        </div>
        <div class="summary-card">
          <h3>${relatorio.totalTriagens}</h3>
          <p>Total de Triagens</p>
        </div>
        <div class="summary-card">
          <h3>${relatorio.percentualResposta}%</h3>
          <p>Taxa de Resposta</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Especialidade</th>
            <th>Triagens</th>
            <th>Respondidas</th>
            <th>Pendentes</th>
            <th>Taxa (%)</th>
          </tr>
        </thead>
        <tbody>
          ${relatorio.dentistas
            .map(
              (r) => `
            <tr>
              <td>${r.dentista.nome || '-'}</td>
              <td>${r.dentista.especialidade || '-'}</td>
              <td>${r.totalTriagens}</td>
              <td>${r.triagensRespondidas}</td>
              <td>${r.triagensPendentes}</td>
              <td>${r.percentualResposta}%</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Este relatorio foi gerado automaticamente pelo sistema Te Odonto Angola</p>
      </div>
    </body>
    </html>
  `;

  return html;
};

/**
 * Imprime o relatorio (web) ou compartilha o HTML (mobile)
 */
export const imprimirRelatorio = async (html: string): Promise<ExportResult> => {
  return exportHtmlAsPdf(html, `relatorio-geral-${new Date().toISOString().split('T')[0]}.pdf`);
};
/**
 * Converte valor para formato de moeda angolana
 */
const formatMoney = (value: number) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

/**
 * Gera HTML para relatorio geral de faturamento da clinica
 */

export const buildGeneralBillingHtml = (relatorio: RelatorioGeral, issuedByName?: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Geral de Faturação</title>
      <style>
        @page { 
          margin: 10mm; 
        }
        @media print {
          * { -webkit-print-color-adjust: exact; }
          body { margin: 0; }
        }
        * { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        body { padding: 40px; background: white; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #7C3AED; padding-bottom: 20px; }
        h1 { color: #7C3AED; font-size: 28px; }
        .subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }
        .summary { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 40px; }
        .summary-card { flex: 1; background: #f8fafc; padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card h3 { color: #7C3AED; font-size: 22px; margin-bottom: 4px; }
        .summary-card p { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        table th { background: #7C3AED; color: white; padding: 12px; text-align: left; font-size: 12px; }
        table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
        .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sorriso Digital</h1>
        <p class="subtitle">Relatório Consolidado de Faturação da Clínica</p>
        <p class="subtitle" style="margin-top: 10px; font-size: 11px; color: #7C3AED;">
          ${issuedByName ? `Emitido por: ${issuedByName}` : ""}
        </p>
        <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-AO')}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <h3>${relatorio.totalProcedimentos}</h3>
          <p>Total Procedimentos</p>
        </div>
        <div class="summary-card">
          <h3>${formatMoney(relatorio.totalFaturado)}</h3>
          <p>Total Faturado</p>
        </div>
        <div class="summary-card">
          <h3>${formatMoney(relatorio.totalRecebido)}</h3>
          <p>Total Recebido</p>
        </div>
        <div class="summary-card">
          <h3 style="color: #b91c1c">${formatMoney(relatorio.totalPendente)}</h3>
          <p>Total Pendente</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Dentista</th>
            <th>Especialidade</th>
            <th>Proc.</th>
            <th>Faturado</th>
            <th>Recebido</th>
            <th>Pendente</th>
          </tr>
        </thead>
        <tbody>
          ${relatorio.dentistas.map(d => `
            <tr>
              <td><strong>${d.dentista.nome || '---'}</strong></td>
              <td>${d.dentista.especialidade || 'Clínica Geral'}</td>
              <td>${d.totalProcedimentos || 0}</td>
              <td>${formatMoney(d.totalFaturado || 0)}</td>
              <td>${formatMoney(d.totalRecebido || 0)}</td>
              <td>${formatMoney(d.pendenteReceber || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Sorriso Digital - Sistema de Gestão Odontológica</p>
        <p>Este relatório contém dados sensíveis. Uso restrito à administração da clínica.</p>
      </div>
    </body>
    </html>
  `;
};
