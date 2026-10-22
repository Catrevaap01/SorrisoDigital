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
      <title>Relatório de Faturação — Dr(a). ${dentistName}</title>
      <style>
        @page { 
          size: A4 portrait; 
          margin: 12mm 15mm 15mm 15mm; 
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          background: #e2e8f0; 
          color: #1e293b; 
          font-size: 11px;
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        .screen-toolbar {
          width: 210mm;
          max-width: 100%;
          margin: 16px auto 12px auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        .screen-toolbar-title { font-size: 12.5px; font-weight: 600; color: #cbd5e1; }
        .screen-toolbar-btn { background: #0284c7; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 20px auto;
          background: #ffffff;
          padding: 16mm 18mm;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          border-radius: 3px;
          box-sizing: border-box;
        }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px; }
        .logo-title { font-size: 20px; font-weight: 800; color: #0369a1; }
        .subtitle { color: #64748b; font-size: 11px; margin-top: 2px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; page-break-inside: avoid; }
        .summary-card { background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card h3 { color: #0284c7; font-size: 18px; font-weight: 800; margin-bottom: 2px; }
        .summary-card p { color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        table th { background: #0284c7; color: white; padding: 7px 9px; text-align: left; font-size: 10px; font-weight: 700; }
        table td { padding: 7px 9px; border-bottom: 1px solid #e2e8f0; }
        .status { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; display: inline-block; }
        .status-pago { background: #dcfce7; color: #166534; }
        .status-parcial { background: #fef9c3; color: #854d0e; }
        .status-pendente { background: #fee2e2; color: #991b1b; }
        .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 36px; page-break-inside: avoid; }
        .sign-box { flex: 1; text-align: center; }
        .sign-line { border-top: 1px solid #475569; margin-bottom: 4px; padding-top: 4px; font-weight: 700; font-size: 10.5px; }
        .footer { text-align: center; margin-top: 28px; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 8px; page-break-inside: avoid; }
        @media print { 
          body { background: white !important; } 
          .screen-toolbar, .no-print { display: none !important; } 
          .a4-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="screen-toolbar no-print">
        <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
        <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
      </div>

      <div class="a4-container">
        <div class="header">
          <div>
            <div class="logo-title">🦷 TeOdonto Angola</div>
            <p class="subtitle">RELATÓRIO INDIVIDUAL DE FATURAÇÃO & HONORÁRIOS</p>
            <p class="subtitle">Médico Dentista: <strong>Dr(a). ${dentistName}</strong></p>
          </div>
          <div style="text-align: right;">
            <p class="subtitle">${issuedByName ? `Emitido por: ${issuedByName}` : 'Emissão do Sistema'}</p>
            <p class="subtitle">Data: <strong>${new Date().toLocaleDateString('pt-AO')}</strong></p>
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>${formatMoney(totalPago)}</h3>
            <p>Total Faturado</p>
          </div>
          <div class="summary-card">
            <h3 style="color:#16a34a">${formatMoney(totalPago)}</h3>
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
              <th>Total</th>
              <th>Valor Pago</th>
              <th>Pendente</th>
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
              const dataRef = item.data_hora || item.appointment_date || item.updated_at || item.created_at;
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
                  <td><strong>${item.paciente_nome || 'Paciente'}</strong></td>
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

        <div class="signatures">
          <div class="sign-box">
            <div class="sign-line">Dr(a). ${dentistName}</div>
            <div style="font-size:9.5px; color:#64748b;">Médico Dentista</div>
          </div>
          <div class="sign-box">
            <div class="sign-line">Direção Financeira</div>
            <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola</div>
          </div>
        </div>

        <div class="footer">
          <p>TeOdonto Angola &nbsp;·&nbsp; Relatório Oficial em Folha A4 &nbsp;·&nbsp; Documento Confidencial</p>
        </div>
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
      <title>Relatório Geral — TeOdonto Angola</title>
      <style>
        @page { 
          size: A4 portrait; 
          margin: 12mm 15mm 15mm 15mm; 
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          background: #e2e8f0; 
          color: #1e293b; 
          font-size: 11px;
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        .screen-toolbar {
          width: 210mm;
          max-width: 100%;
          margin: 16px auto 12px auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        .screen-toolbar-title { font-size: 12.5px; font-weight: 600; color: #cbd5e1; }
        .screen-toolbar-btn { background: #0284c7; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 20px auto;
          background: #ffffff;
          padding: 16mm 18mm;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          border-radius: 3px;
          box-sizing: border-box;
        }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; }
        .logo-title { font-size: 20px; font-weight: 800; color: #0369a1; }
        .subtitle { color: #64748b; font-size: 11px; margin-top: 2px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; page-break-inside: avoid; }
        .summary-card { background: #f8fafc; padding: 10px 12px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card h3 { color: #0284c7; font-size: 18px; font-weight: 800; margin-bottom: 2px; }
        .summary-card p { color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        table th { background: #0284c7; color: white; padding: 7px 9px; text-align: left; font-size: 10px; font-weight: 700; }
        table td { padding: 7px 9px; border-bottom: 1px solid #e2e8f0; }
        .footer { text-align: center; margin-top: 26px; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 8px; page-break-inside: avoid; }
        @media print { 
          body { background: white !important; } 
          .screen-toolbar, .no-print { display: none !important; } 
          .a4-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="screen-toolbar no-print">
        <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
        <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
      </div>

      <div class="a4-container">
        <div class="header">
          <div>
            <div class="logo-title">🦷 TeOdonto Angola</div>
            <p class="subtitle">RELATÓRIO GERAL DO CORPO CLÍNICO</p>
          </div>
          <div style="text-align: right;">
            <p class="subtitle">Emissão: <strong>${dataBR}</strong></p>
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>${relatorio.totalDentistas}</h3>
            <p>Total de Dentistas</p>
          </div>
          <div class="summary-card">
            <h3>${relatorio.dentistasAtivos}</h3>
            <p>Dentistas Activos</p>
          </div>
          <div class="summary-card">
            <h3>${relatorio.totalTriagens}</h3>
            <p>Total de Triagens</p>
          </div>
          <div class="summary-card">
            <h3 style="color:#16a34a">${relatorio.percentualResposta}%</h3>
            <p>Taxa de Resposta</p>
          </div>
          <div class="summary-card">
            <h3>${relatorio.dentistasMes || 0}</h3>
            <p>Novos Dentistas no Mês</p>
          </div>
          <div class="summary-card">
            <h3>${relatorio.pacientesMes || 0}</h3>
            <p>Novos Pacientes no Mês</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Especialidade</th>
              <th style="text-align:center;">Triagens</th>
              <th style="text-align:center;">Respondidas</th>
              <th style="text-align:center;">Pendentes</th>
              <th style="text-align:center;">Taxa (%)</th>
            </tr>
          </thead>
          <tbody>
            ${relatorio.dentistas
              .map(
                (r) => `
              <tr>
                <td><strong>Dr(a). ${r.dentista.nome || '-'}</strong></td>
                <td>${r.dentista.especialidade || 'Clínica Geral'}</td>
                <td style="text-align:center;">${r.totalTriagens}</td>
                <td style="text-align:center;">${r.triagensRespondidas}</td>
                <td style="text-align:center;">${r.triagensPendentes}</td>
                <td style="text-align:center;"><strong>${r.percentualResposta}%</strong></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>TeOdonto Angola &nbsp;·&nbsp; Relatório Oficial em Folha A4 &nbsp;·&nbsp; Documento Oficial</p>
        </div>
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
      <title>Relatório Geral de Faturação — TeOdonto Angola</title>
      <style>
        @page { 
          size: A4 portrait; 
          margin: 12mm 15mm 15mm 15mm; 
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          background: #e2e8f0; 
          color: #1e293b; 
          font-size: 11px;
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        .screen-toolbar {
          width: 210mm;
          max-width: 100%;
          margin: 16px auto 12px auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        }
        .screen-toolbar-title { font-size: 12.5px; font-weight: 600; color: #cbd5e1; }
        .screen-toolbar-btn { background: #0284c7; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; }
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 20px auto;
          background: #ffffff;
          padding: 16mm 18mm;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          border-radius: 3px;
          box-sizing: border-box;
        }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; }
        .logo-title { font-size: 20px; font-weight: 800; color: #0369a1; }
        .subtitle { color: #64748b; font-size: 11px; margin-top: 2px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; page-break-inside: avoid; }
        .summary-card { background: #f8fafc; padding: 10px 12px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
        .summary-card h3 { color: #0284c7; font-size: 17px; font-weight: 800; margin-bottom: 2px; }
        .summary-card p { color: #64748b; font-size: 9.5px; text-transform: uppercase; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        table th { background: #0284c7; color: white; padding: 7px 9px; text-align: left; font-size: 10px; font-weight: 700; }
        table td { padding: 7px 9px; border-bottom: 1px solid #e2e8f0; }
        .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 36px; page-break-inside: avoid; }
        .sign-box { flex: 1; text-align: center; }
        .sign-line { border-top: 1px solid #475569; margin-bottom: 4px; padding-top: 4px; font-weight: 700; font-size: 10.5px; }
        .footer { text-align: center; margin-top: 26px; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 8px; page-break-inside: avoid; }
        @media print { 
          body { background: white !important; } 
          .screen-toolbar, .no-print { display: none !important; } 
          .a4-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="screen-toolbar no-print">
        <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
        <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
      </div>

      <div class="a4-container">
        <div class="header">
          <div>
            <div class="logo-title">🦷 TeOdonto Angola</div>
            <p class="subtitle">RELATÓRIO CONSOLIDADO DE FATURAÇÃO & PRODUÇÃO</p>
            <p class="subtitle" style="margin-top: 4px; font-size: 10.5px; color: #0284c7;">
              ${issuedByName ? `Emitido por: ${issuedByName}` : "Administração Geral"}
            </p>
          </div>
          <div style="text-align: right;">
            <p class="subtitle">Data: <strong>${new Date().toLocaleDateString('pt-AO')}</strong></p>
          </div>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>${relatorio.totalProcedimentos}</h3>
            <p>Procedimentos</p>
          </div>
          <div class="summary-card">
            <h3>${formatMoney(relatorio.totalFaturado)}</h3>
            <p>Total Faturado</p>
          </div>
          <div class="summary-card">
            <h3 style="color:#16a34a">${formatMoney(relatorio.totalRecebido)}</h3>
            <p>Recebido</p>
          </div>
          <div class="summary-card">
            <h3 style="color: #b91c1c">${formatMoney(relatorio.totalPendente)}</h3>
            <p>Pendente</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Médico Dentista</th>
              <th>Especialidade</th>
              <th style="text-align:center;">Proc.</th>
              <th style="text-align:right;">Faturado</th>
              <th style="text-align:right;">Recebido</th>
              <th style="text-align:right;">Pendente</th>
            </tr>
          </thead>
          <tbody>
            ${relatorio.dentistas.map(d => `
              <tr>
                <td><strong>Dr(a). ${d.dentista.nome || '---'}</strong></td>
                <td>${d.dentista.especialidade || 'Clínica Geral'}</td>
                <td style="text-align:center;">${d.totalProcedimentos || 0}</td>
                <td style="text-align:right;">${formatMoney(d.totalFaturado || 0)}</td>
                <td style="text-align:right; color:#16a34a; font-weight:bold;">${formatMoney(d.totalRecebido || 0)}</td>
                <td style="text-align:right; color:#b91c1c;">${formatMoney(d.pendenteReceber || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sign-box">
            <div class="sign-line">Direção Clínica</div>
            <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola</div>
          </div>
          <div class="sign-box">
            <div class="sign-line">Direção Financeira</div>
            <div style="font-size:9.5px; color:#64748b;">TeOdonto Angola</div>
          </div>
        </div>

        <div class="footer">
          <p>TeOdonto Angola &nbsp;·&nbsp; Sistema Digital de Odontologia em Folha A4 &nbsp;·&nbsp; Documento Oficial</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
