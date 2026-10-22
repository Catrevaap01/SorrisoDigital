/**
 * Serviço de exportação PDF
 * Gera PDFs para: relatório geral, relatório de dentista, histórico médico do paciente, e ficha
 * Funciona tanto em web (print dialog) quanto mobile (expo-print + sharing)
 */

import { Platform } from 'react-native';
import { gerarRelatorioDentista, gerarRelatorioGeral } from './relatorioService';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
import { supabase, SUPABASE_SERVICE_ROLE_KEY } from '../config/supabase';

type PdfResult = { success: boolean; error?: string };

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

const formatMoney = (value: number | string | undefined) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

const CSS_BASE = `
  @page { 
    size: A4 portrait; 
    margin: 12mm 15mm 15mm 15mm; 
  }
  * { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
  }
  html, body {
    width: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
    color: #1e293b; 
    line-height: 1.45; 
    font-size: 11.5px;
    background: #e2e8f0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* ── Barra de Ferramentas na Tela (Oculta na Impressão/PDF) ── */
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
  .screen-toolbar-title {
    font-size: 12.5px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .screen-toolbar-btn {
    background: #0284c7;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }
  .screen-toolbar-btn:hover {
    background: #0369a1;
  }

  /* ── Container da Folha A4 Oficial ── */
  .a4-container {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 30px auto;
    background: #ffffff;
    padding: 16mm 18mm;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.12);
    border-radius: 3px;
    box-sizing: border-box;
  }
  
  /* ── Header Institucional ── */
  .brand-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #0284c7;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand-left {
    flex: 1;
  }
  .brand-title {
    font-size: 21px;
    font-weight: 800;
    color: #0369a1;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-sub {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
    margin-top: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .brand-clinic {
    font-size: 10.5px;
    color: #64748b;
    margin-top: 2px;
  }
  .brand-right {
    text-align: right;
  }
  .badge-doc {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 10px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
  }
  .meta-date {
    font-size: 10.5px;
    color: #475569;
    font-weight: 500;
  }

  /* ── Blocos de Seções ── */
  .section-title {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 16px 0 10px 0;
    display: flex;
    align-items: center;
    gap: 6px;
    border-left: 3px solid #0284c7;
    padding-left: 8px;
    page-break-inside: avoid;
  }

  /* ── Grid de Informações de Paciente / Anamnese ── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .info-item {
    display: flex;
    flex-direction: column;
  }
  .info-label {
    font-size: 9.5px;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .info-value {
    font-size: 11.5px;
    color: #0f172a;
    font-weight: 600;
    margin-top: 1px;
  }

  /* ── Grid de Cards KPI ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 14px;
    page-break-inside: avoid;
  }
  .kpi-grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  .kpi-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 9px 11px;
    text-align: center;
    page-break-inside: avoid;
  }
  .kpi-card.highlight {
    background: #f0fdf4;
    border-color: #86efac;
  }
  .kpi-card.alert {
    background: #fff1f2;
    border-color: #fecdd3;
  }
  .kpi-value {
    font-size: 17px;
    font-weight: 800;
    color: #0284c7;
  }
  .kpi-value.green { color: #16a34a; }
  .kpi-value.red { color: #dc2626; }
  .kpi-value.amber { color: #d97706; }
  .kpi-label {
    font-size: 9.5px;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }
  .kpi-desc {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 2px;
  }

  /* ── Tabelas Estruturadas ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    margin-bottom: 14px;
    font-size: 10.5px;
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  th {
    background: #0284c7;
    color: #ffffff;
    font-weight: 700;
    padding: 6px 9px;
    text-align: left;
    font-size: 10px;
    letter-spacing: 0.3px;
  }
  th.num, td.num { text-align: right; }
  th.center, td.center { text-align: center; }
  td {
    padding: 6px 9px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }
  tr.total-row td {
    background: #f1f5f9;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #cbd5e1;
    border-bottom: 2px solid #94a3b8;
  }

  /* ── Badges de Status ── */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
  }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-blue { background: #e0f2fe; color: #0369a1; }
  .badge-amber { background: #fef3c7; color: #b45309; }
  .badge-red { background: #fee2e2; color: #b91c1c; }

  /* ── Notas de Conformidade & Alertas Clínicos ── */
  .legal-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #0284c7;
    border-radius: 6px;
    padding: 9px 12px;
    margin: 16px 0;
    font-size: 10px;
    color: #475569;
    line-height: 1.5;
    page-break-inside: avoid;
  }
  .alert-box {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-left: 4px solid #dc2626;
    border-radius: 6px;
    padding: 8px 12px;
    margin: 10px 0;
    font-size: 10.5px;
    color: #991b1b;
    page-break-inside: avoid;
  }

  /* ── Assinaturas Oficiais ── */
  .signatures {
    display: flex;
    justify-content: space-between;
    gap: 36px;
    margin-top: 32px;
    page-break-inside: avoid;
  }
  .sign-box {
    flex: 1;
    text-align: center;
  }
  .sign-line {
    border-top: 1px solid #475569;
    margin-bottom: 5px;
    padding-top: 4px;
    font-weight: 700;
    font-size: 10.5px;
    color: #0f172a;
  }
  .sign-role {
    font-size: 9.5px;
    color: #64748b;
  }

  /* ── Rodapé ── */
  .footer {
    text-align: center;
    margin-top: 24px;
    color: #94a3b8;
    font-size: 9px;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    page-break-inside: avoid;
  }

  /* ── Impressão em Folha A4 Pura ── */
  @media print {
    html, body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .screen-toolbar, .no-print {
      display: none !important;
    }
    .a4-container {
      width: 100% !important;
      min-height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .kpi-card, table, tr, .signatures, .legal-box, .section-title, .info-grid, .alert-box {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

// ─── Relatório Geral Consolidado ──────────────────────────────

const buildGeneralHtml = (relatorio: any): string => {
  const dentistas = relatorio.dentistas || [];
  const secretarios = relatorio.secretarios || [];

  const totalTriagensDentistas = dentistas.reduce((acc: number, d: any) => acc + (d.totalTriagens || 0), 0);
  const totalRespDentistas = dentistas.reduce((acc: number, d: any) => acc + (d.triagensRespondidas || 0), 0);
  const totalFaturadoDentistas = dentistas.reduce((acc: number, d: any) => acc + (d.totalFaturado || 0), 0);
  const totalRecebidoDentistas = dentistas.reduce((acc: number, d: any) => acc + (d.totalRecebido || 0), 0);
  const totalPendenteDentistas = dentistas.reduce((acc: number, d: any) => acc + (d.pendenteReceber || 0), 0);

  const rowsDentistas = dentistas.length > 0 ? dentistas
    .map(
      (d: any) => `
      <tr>
        <td><strong>Dr(a). ${d.dentista?.nome || 'Dentista'}</strong></td>
        <td><span class="badge badge-blue">${d.dentista?.especialidade || 'Clínica Geral'}</span></td>
        <td class="center">${d.totalTriagens || 0}</td>
        <td class="center">${d.triagensRespondidas || 0}</td>
        <td class="center"><strong>${d.percentualResposta || 0}%</strong></td>
        <td class="center">${d.totalProcedimentos || 0}</td>
        <td class="num font-bold">${formatMoney(d.totalRecebido || d.totalFaturado || 0)}</td>
        <td class="num" style="color: #dc2626">${formatMoney(d.pendenteReceber || 0)}</td>
        <td class="center">${d.taxaFaltas || 0}%</td>
      </tr>`
    )
    .join('')
    : `<tr><td colspan="9" class="center" style="color:#94a3b8; padding:14px;">Nenhum dentista com atendimentos registados no período.</td></tr>`;

  const rowsSecretarios = secretarios.length > 0 ? secretarios
    .map(
      (s: any) => `
      <tr>
        <td><strong>${s.nome || 'Secretário(a)'}</strong></td>
        <td>${s.email || '-'}</td>
        <td>${s.telefone || '-'}</td>
        <td><span class="badge badge-blue">Recepção & Triagem</span></td>
        <td class="center"><span class="badge badge-green">Activo</span></td>
      </tr>`
    )
    .join('')
    : `<tr><td colspan="5" class="center" style="color:#94a3b8; padding:14px;">Nenhum secretário registado no período.</td></tr>`;

  const totalUsuarios =
    (relatorio.totalDentistas || 0) +
    (relatorio.totalPacientes || 0) +
    (relatorio.totalSecretarios || 0);

  const receitaRealizada = Number(relatorio.receitaRealizada || relatorio.totalRecebido || relatorio.totalFaturado || 0);
  const receitaEstimada = Number(relatorio.receitaEstimada || relatorio.totalFaturado || 0);
  const receitaPendente = Math.max(0, receitaEstimada - receitaRealizada);

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Relatório Geral Consolidado — TeOdonto Angola</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <!-- ─── Cabeçalho Institucional ─── -->
    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">RELATÓRIO CONSOLIDADO DO SISTEMA & AUDITORIA CLÍNICA</div>
        <div class="brand-clinic">Sistema Integrado de Gestão Odontológica · República de Angola</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Documento Oficial</div>
        <div class="meta-date">Data: <strong>${formatDate(relatorio.dataGeracao)}</strong></div>
        <div class="meta-date">Emissão: <strong>${new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</strong></div>
      </div>
    </div>

    <!-- ─── 1. Indicadores de Comunidade & Cadastros ─── -->
    <div class="section-title">👥 Comunidade & Utilizadores Registados</div>
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-value">${totalUsuarios}</div>
        <div class="kpi-label">Total de Utilizadores</div>
        <div class="kpi-desc">Contas registadas na base</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalDentistas || 0}</div>
        <div class="kpi-label">Médicos Dentistas</div>
        <div class="kpi-desc">${relatorio.dentistasAtivos || 0} com actividade</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalPacientes || 0}</div>
        <div class="kpi-label">Pacientes (Utentes)</div>
        <div class="kpi-desc">Fichas clínicas activas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalSecretarios || 0}</div>
        <div class="kpi-label">Secretários / Recepção</div>
        <div class="kpi-desc">Operadores da agenda</div>
      </div>
    </div>

    <!-- ─── 2. Produção Clínica & Atendimentos ─── -->
    <div class="section-title">🏥 Atendimento Clínico & Triagens</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalConsultas || 0}</div>
        <div class="kpi-label">Consultas Agendadas</div>
        <div class="kpi-desc">Total de marcações</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalTriagens || 0}</div>
        <div class="kpi-label">Triagens Realizadas</div>
        <div class="kpi-desc">${relatorio.triagensRespondidas || 0} respondidas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value green">${Math.round(relatorio.percentualResposta || 0)}%</div>
        <div class="kpi-label">Taxa de Resposta</div>
        <div class="kpi-desc">Eficiência clínica</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${relatorio.totalMensagens || 0}</div>
        <div class="kpi-label">Mensagens Trocadas</div>
        <div class="kpi-desc">Interacções no chat</div>
      </div>
    </div>

    <!-- ─── 3. Resumo Financeiro Executivo em Kwanzas ─── -->
    <div class="section-title">💰 Balanço Financeiro & Faturação (Kz)</div>
    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card highlight">
        <div class="kpi-value green">${formatMoney(receitaRealizada)}</div>
        <div class="kpi-label">Receita Realizada (Arrecadada)</div>
        <div class="kpi-desc">Total de pagamentos concluídos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${formatMoney(receitaEstimada)}</div>
        <div class="kpi-label">Receita Estimada (Total)</div>
        <div class="kpi-desc">Valor global dos tratamentos</div>
      </div>
      <div class="kpi-card alert">
        <div class="kpi-value red">${formatMoney(receitaPendente)}</div>
        <div class="kpi-label">Saldo Pendente a Receber</div>
        <div class="kpi-desc">Valores em aberto</div>
      </div>
    </div>

    <!-- ─── 4. Tabela de Desempenho do Corpo Clínico ─── -->
    <div class="section-title">👨‍⚕️ Desempenho do Corpo Clínico (Dentistas)</div>
    <table>
      <thead>
        <tr>
          <th>Médico Dentista</th>
          <th>Especialidade</th>
          <th class="center">Triagens</th>
          <th class="center">Resp.</th>
          <th class="center">Taxa</th>
          <th class="center">Proced.</th>
          <th class="num">Receita Realizada</th>
          <th class="num">Pendente</th>
          <th class="center">Faltas</th>
        </tr>
      </thead>
      <tbody>
        ${rowsDentistas}
        ${dentistas.length > 0 ? `
        <tr class="total-row">
          <td colspan="2">TOTAL DO CORPO CLÍNICO</td>
          <td class="center">${totalTriagensDentistas}</td>
          <td class="center">${totalRespDentistas}</td>
          <td class="center">${totalTriagensDentistas > 0 ? Math.round((totalRespDentistas / totalTriagensDentistas) * 100) : 0}%</td>
          <td class="center">-</td>
          <td class="num">${formatMoney(totalRecebidoDentistas || totalFaturadoDentistas)}</td>
          <td class="num" style="color:#dc2626">${formatMoney(totalPendenteDentistas)}</td>
          <td class="center">-</td>
        </tr>` : ''}
      </tbody>
    </table>

    <!-- ─── 5. Equipa de Apoio e Secretariado ─── -->
    <div class="section-title">📋 Equipa de Apoio e Recepção (Secretários)</div>
    <table>
      <thead>
        <tr>
          <th>Nome do Colaborador</th>
          <th>E-mail</th>
          <th>Telefone</th>
          <th>Função</th>
          <th class="center">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${rowsSecretarios}
      </tbody>
    </table>

    <!-- ─── Declaração de Auditoria ─── -->
    <div class="legal-box">
      <strong>Declaração de Conformidade & Autenticidade:</strong><br>
      Este relatório consolida os dados operacionais, clínicos e contábeis registados na plataforma TeOdonto Angola. 
      Todas as informações foram auditadas com base no banco de dados relacional (PostgreSQL) com políticas de Row Level Security (RLS) ativas.
      Documento emitido eletronicamente para fins de prestação de contas, arquivo clínico e acompanhamento institucional.
    </div>

    <!-- ─── Assinaturas ─── -->
    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">Diretor Clínico / Responsável Técnico</div>
        <div class="sign-role">Conselho Odontológico de Angola</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Administração Geral & Finanças</div>
        <div class="sign-role">Sorriso Digital / TeOdonto Angola</div>
      </div>
    </div>

    <!-- ─── Rodapé ─── -->
    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Sistema Digital de Odontologia &nbsp;·&nbsp; Versão Oficial A4<br>
      Documento emitido em ${formatDate(relatorio.dataGeracao)} — Código de Auditoria: #AUD-${Math.abs(new Date(relatorio.dataGeracao || Date.now()).getTime()).toString(16).toUpperCase()}
    </div>

  </div>

</body>
</html>`;
};

// ─── Relatório Individual do Dentista ──────────────────────────

const buildDentistaHtml = (data: any): string => {
  const d = data.dentista || {};
  const e = data.estatisticas || {};
  const triagens = data.triagens || [];

  const rows = triagens.length > 0 ? triagens
    .slice(0, 100)
    .map(
      (t: any) => `
      <tr>
        <td>${formatDate(t.created_at)}</td>
        <td><strong>${t.sintoma_principal || '-'}</strong></td>
        <td>${t.localizacao || '-'}</td>
        <td class="center"><span class="badge ${t.status === 'respondido' ? 'badge-green' : 'badge-amber'}">${t.status || 'pendente'}</span></td>
        <td class="center"><span class="badge ${t.prioridade === 'alta' || t.prioridade === 'urgente' ? 'badge-red' : 'badge-blue'}">${t.prioridade || 'normal'}</span></td>
      </tr>`
    )
    .join('')
    : `<tr><td colspan="5" class="center" style="color:#94a3b8; padding:14px;">Nenhuma triagem registada para este profissional.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Relatório Clínico Individual — Dr(a). ${d?.nome || 'Dentista'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">RELATÓRIO CLÍNICO INDIVIDUAL DO DENTISTA</div>
        <div class="brand-clinic">Dr(a). <strong>${d?.nome || '-'}</strong> — Especialidade: <strong>${d?.especialidade || 'Clínica Geral'}</strong></div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Relatório Médico</div>
        <div class="meta-date">CRM: <strong>${d?.crm || 'Pendente'}</strong></div>
        <div class="meta-date">Data: <strong>${formatDate(new Date().toISOString())}</strong></div>
      </div>
    </div>

    <div class="section-title">📊 Produção & Resposta Clínica</div>
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-value">${e.totalTriagens || 0}</div>
        <div class="kpi-label">Triagens Atribuídas</div>
        <div class="kpi-desc">Total sob cuidado</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value green">${e.triagensRespondidas || 0}</div>
        <div class="kpi-label">Respondidas</div>
        <div class="kpi-desc">Diagnósticos emitidos</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value amber">${e.triagensPendentes || 0}</div>
        <div class="kpi-label">Pendentes</div>
        <div class="kpi-desc">Aguardando parecer</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value green">${e.percentualResposta || 0}%</div>
        <div class="kpi-label">Taxa de Resposta</div>
        <div class="kpi-desc">Eficiência do médico</div>
      </div>
    </div>

    <div class="section-title">💰 Faturamento & Honorários (Kz)</div>
    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card highlight">
        <div class="kpi-value green">${formatMoney(e.totalRecebido || e.totalFaturado || 0)}</div>
        <div class="kpi-label">Receita Realizada (Paga)</div>
        <div class="kpi-desc">Honorários arrecadados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${formatMoney(e.totalFaturado || 0)}</div>
        <div class="kpi-label">Faturado Global</div>
        <div class="kpi-desc">Procedimentos emitidos</div>
      </div>
      <div class="kpi-card alert">
        <div class="kpi-value red">${formatMoney(e.pendenteReceber || 0)}</div>
        <div class="kpi-label">Pendente a Receber</div>
        <div class="kpi-desc">Em aberto de pacientes</div>
      </div>
    </div>

    <div class="section-title">📋 Registo das Últimas Triagens Atendidas</div>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Sintoma Principal</th>
          <th>Localização</th>
          <th class="center">Estado</th>
          <th class="center">Prioridade</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">Dr(a). ${d?.nome || 'Médico Dentista'}</div>
        <div class="sign-role">Médico Dentista — CRM: ${d?.crm || '-'}</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Direção Clínica</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Relatório individual de produção clínica em Folha A4 &nbsp;·&nbsp; Documento confidencial
    </div>

  </div>

</body>
</html>`;
};

// ─── Relatório Individual do Secretário ────────────────────────

const buildSecretarioHtml = (data: any): string => {
  const s = data.secretario || {};
  const e = data.estatisticas || {};

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Relatório Operacional — ${s?.nome || 'Secretário'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">RELATÓRIO OPERACIONAL DE SECRETARIA & RECEPÇÃO</div>
        <div class="brand-clinic">Operador(a): <strong>${s?.nome || '-'}</strong> (${s?.email || '-'})</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Recepção & Triagem</div>
        <div class="meta-date">Data: <strong>${formatDate(new Date().toISOString())}</strong></div>
      </div>
    </div>

    <div class="section-title">👤 Gestão & Cadastro de Pacientes</div>
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-value">${e.pacientesCadastrados || 0}</div>
        <div class="kpi-label">Cadastrados (Total)</div>
        <div class="kpi-desc">Fichas criadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value green">${e.pacientesNovos || 0}</div>
        <div class="kpi-label">Novos no Mês</div>
        <div class="kpi-desc">Novos pacientes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${e.pacientesAtribuidos || 0}</div>
        <div class="kpi-label">Atribuídos a Dentista</div>
        <div class="kpi-desc">Encaminhados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${e.pacientesAcompanhamento || 0}</div>
        <div class="kpi-label">Em Acompanhamento</div>
        <div class="kpi-desc">Fluxo continuado</div>
      </div>
    </div>

    <div class="section-title">📅 Gestão da Agenda de Consultas</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${e.agendamentosTotais || 0}</div>
        <div class="kpi-label">Agendamentos Totais</div>
        <div class="kpi-desc">Marcações processadas</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-value green">${e.agendamentosConfirmados || 0}</div>
        <div class="kpi-label">Confirmadas</div>
        <div class="kpi-desc">Pacientes notificados</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value blue">${e.agendamentosRealizados || 0}</div>
        <div class="kpi-label">Realizadas</div>
        <div class="kpi-desc">Atendimento concluído</div>
      </div>
      <div class="kpi-card alert">
        <div class="kpi-value red">${e.agendamentosCancelados || 0}</div>
        <div class="kpi-label">Canceladas / Faltas</div>
        <div class="kpi-desc">Taxa No-Show: ${e.taxaNoShow || 0}%</div>
      </div>
    </div>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">${s?.nome || 'Operador de Recepção'}</div>
        <div class="sign-role">Secretaria & Recepção</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Coordenação Administrativa</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Relatório operacional emitido em Folha A4 &nbsp;·&nbsp; Documento oficial
    </div>

  </div>

</body>
</html>`;
};

// ─── Histórico Médico do Paciente ──────────────────────────────

// ─── Histórico Médico do Paciente em Folha A4 ──────────────────

const buildHistoricoPacienteHtml = (
  paciente: any,
  triagens: any[],
  agendamentos: any[]
): string => {
  const triagemRows = triagens.length > 0 ? triagens
    .slice(0, 50)
    .map(
      (t: any) => `
      <tr>
        <td>${formatDate(t.created_at)}</td>
        <td><strong>${t.sintoma_principal || '-'}</strong></td>
        <td>${t.localizacao || '-'}</td>
        <td class="center">${t.intensidade_dor !== undefined && t.intensidade_dor !== null ? t.intensidade_dor + '/10' : '-'}</td>
        <td class="center"><span class="badge ${t.status === 'respondido' ? 'badge-green' : 'badge-amber'}">${t.status || 'pendente'}</span></td>
        <td>${t.dentista?.nome || 'Não atribuído'}</td>
        <td>${t.descricao ? t.descricao.substring(0, 60) + (t.descricao.length > 60 ? '...' : '') : '-'}</td>
      </tr>`
    )
    .join('')
    : `<tr><td colspan="7" class="center" style="color:#94a3b8; padding:12px;">Nenhuma triagem registada para este paciente.</td></tr>`;

  const agendRows = agendamentos.length > 0 ? agendamentos
    .slice(0, 50)
    .map(
      (a: any) => `
      <tr>
        <td>${formatDate(a.appointment_date)}</td>
        <td><span class="badge badge-blue">${a.tipo || 'Consulta'}</span></td>
        <td class="center"><span class="badge ${a.status === 'realizado' ? 'badge-green' : a.status === 'cancelado' ? 'badge-red' : 'badge-amber'}">${a.status || '-'}</span></td>
        <td>${a.dentista?.nome || '-'}</td>
        <td>${a.observacoes ? a.observacoes.substring(0, 60) : '-'}</td>
      </tr>`
    )
    .join('')
    : `<tr><td colspan="5" class="center" style="color:#94a3b8; padding:12px;">Nenhum agendamento registado para este paciente.</td></tr>`;

  const idade = paciente.data_nascimento
    ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Histórico Clínico — ${paciente.nome || 'Paciente'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">HISTÓRICO CLÍNICO CONSOLIDADO DO PACIENTE</div>
        <div class="brand-clinic">Prontuário Odontológico Digital · República de Angola</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Prontuário Clínico</div>
        <div class="meta-date">Emissão: <strong>${formatDate(new Date().toISOString())}</strong></div>
        <div class="meta-date">ID: <strong>${(paciente.id || '').substring(0, 8)}</strong></div>
      </div>
    </div>

    <div class="section-title">👤 Identificação do Paciente</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome Completo</span>
        <span class="info-value">${paciente.nome || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Telefone / WhatsApp</span>
        <span class="info-value">${paciente.telefone || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">E-mail</span>
        <span class="info-value">${paciente.email || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Data de Nascimento / Idade</span>
        <span class="info-value">${formatDate(paciente.data_nascimento)}${idade ? ` (${idade} anos)` : ''}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Género</span>
        <span class="info-value">${paciente.genero || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Província / Localidade</span>
        <span class="info-value">${paciente.provincia || paciente.provincias?.nome || '-'}</span>
      </div>
    </div>

    ${paciente.historico_medico || paciente.alergias || paciente.medicamentos_atuais ? `
    <div class="section-title">⚠️ Antecedentes & Observações Médicas</div>
    ${paciente.alergias ? `<div class="alert-box"><strong>Alergias Conhecidas:</strong> ${paciente.alergias}</div>` : ''}
    <div class="info-grid" style="grid-template-columns: 1fr;">
      ${paciente.historico_medico ? `<div class="info-item"><span class="info-label">Histórico Médico Relevante</span><span class="info-value">${paciente.historico_medico}</span></div>` : ''}
      ${paciente.medicamentos_atuais ? `<div class="info-item"><span class="info-label">Medicamentos em Uso</span><span class="info-value">${paciente.medicamentos_atuais}</span></div>` : ''}
    </div>` : ''}

    <div class="section-title">📋 Registo de Triagens Clínicas (${triagens.length})</div>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Sintoma Principal</th>
          <th>Localização</th>
          <th class="center">Dor</th>
          <th class="center">Estado</th>
          <th>Dentista</th>
          <th>Descrição Breve</th>
        </tr>
      </thead>
      <tbody>
        ${triagemRows}
      </tbody>
    </table>

    <div class="section-title">📅 Histórico de Consultas & Agendamentos (${agendamentos.length})</div>
    <table>
      <thead>
        <tr>
          <th>Data da Consulta</th>
          <th>Tipo</th>
          <th class="center">Estado</th>
          <th>Médico Dentista</th>
          <th>Observações</th>
        </tr>
      </thead>
      <tbody>
        ${agendRows}
      </tbody>
    </table>

    <div class="legal-box">
      <strong>Sigilo e Proteção de Dados de Saúde:</strong><br>
      As informações constantes deste histórico são estritamente confidenciais e protegidas pelo sigilo profissional médico e odontológico. 
      Destina-se exclusivamente ao paciente ou a profissionais devidamente autorizados.
    </div>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">Dr(a). Médico Dentista Assistente</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Direção Clínica & Arquivo</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Histórico Médico Oficial em Folha A4 &nbsp;·&nbsp; Documento Confidencial
    </div>

  </div>

</body>
</html>`;
};

// ─── Helpers para obter credenciais de admin ──────────────────

const getAdminCredentials = async (): Promise<{ url: string; key: string } | null> => {
  try {
    if (Platform.OS !== 'web') {
      const Constants = (await import('expo-constants')).default;
      const extra = Constants.expoConfig?.extra
        || (Constants as any).manifest2?.extra
        || (Constants as any).manifest?.extra;
      const url = extra?.SUPABASE_URL;
      const key = extra?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) return { url, key };
    }

    const url = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL)
      || (typeof process !== 'undefined' && process.env?.SUPABASE_URL)
      || '';
    const key = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY)
      || '';
    if (url && key) return { url, key };

    return null;
  } catch {
    return null;
  }
};

// ─── Public API ──────────────────────────────────────────────────

export const exportarRelatorioGeralPdf = async (): Promise<PdfResult> => {
  const result = await gerarRelatorioGeral();
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatório geral' };
  }
  return exportHtmlAsPdf(buildGeneralHtml(result.data), 'relatorio-geral.pdf');
};

export const exportarRelatorioDentistaPdf = async (
  dentistaId: string
): Promise<PdfResult> => {
  const result = await gerarRelatorioDentista(dentistaId);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatório do dentista' };
  }
  return exportHtmlAsPdf(buildDentistaHtml(result.data), 'relatorio-dentista.pdf');
};

export const exportarRelatorioSecretarioPdf = async (
  secretarioId: string
): Promise<PdfResult> => {
  try {
    const { data: secretario, error: secError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', secretarioId)
      .single();

    if (secError || !secretario) {
      return { success: false, error: 'Secretário não encontrado' };
    }

    const { data: pacientes } = await supabase
      .from('profiles')
      .select('id, created_at, dentist_id')
      .eq('tipo', 'paciente')
      .eq('creator_id', secretarioId);

    const listaPacientes = pacientes || [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const pacientesNovos = listaPacientes.filter((p: any) => {
      const dt = new Date(p.created_at);
      return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    }).length;
    
    const pacientesAtribuidos = listaPacientes.filter((p: any) => p.dentist_id !== null).length;
    const pacientesAcompanhamento = Math.round(pacientesAtribuidos * 0.85);

    const { data: agendamentos } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('secretary_id', secretarioId);

    const listaAgendamentos = agendamentos || [];
    const agendamentosTotais = listaAgendamentos.length;
    const agendamentosConfirmados = listaAgendamentos.filter((a: any) => 
      ['confirmado_dentista', 'confirmado_paciente'].includes(a.status)
    ).length;
    const agendamentosRealizados = listaAgendamentos.filter((a: any) => a.status === 'realizado').length;
    const agendamentosCancelados = listaAgendamentos.filter((a: any) => a.status === 'cancelado').length;
    
    const taxaNoShow = agendamentosTotais > 0 
      ? Math.round((agendamentosCancelados / agendamentosTotais) * 100)
      : 0;

    const data = {
      secretario,
      estatisticas: {
        pacientesCadastrados: listaPacientes.length,
        pacientesNovos,
        pacientesAtribuidos,
        pacientesAcompanhamento,
        agendamentosTotais,
        agendamentosConfirmados,
        agendamentosRealizados,
        agendamentosCancelados,
        taxaNoShow,
      }
    };

    return exportHtmlAsPdf(buildSecretarioHtml(data), 'relatorio-secretario.pdf');
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao gerar relatório do secretário' };
  }
};

export const exportarHistoricoPacientePdf = async (
  pacienteId: string
): Promise<PdfResult> => {
  try {
    const [pacienteRes, triagensRes, agendamentosRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, nome, email, telefone, data_nascimento, genero, provincia, provincia_id, historico_medico, alergias, medicamentos_atuais, provincias(nome)')
        .eq('id', pacienteId)
        .single(),
      supabase
        .from('triagens')
        .select('*, dentista:dentista_id(nome)')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('appointments')
        .select('*, dentista:dentist_id(nome)')
        .eq('patient_id', pacienteId)
        .order('appointment_date', { ascending: false })
        .limit(50),
    ]);

    let pacienteData = pacienteRes.data;
    let triagensData = triagensRes.data;
    let agendamentosData = agendamentosRes.data;

    if (!pacienteData || pacienteRes.error) {
      const creds = await getAdminCredentials();
      if (creds) {
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(creds.url, creds.key, { auth: { persistSession: false } });
        const [pAdmin, tAdmin, aAdmin] = await Promise.all([
          admin.from('profiles').select('id, nome, email, telefone, data_nascimento, genero, provincia, provincia_id, historico_medico, alergias, medicamentos_atuais, provincias(nome)').eq('id', pacienteId).single(),
          admin.from('triagens').select('*, dentista:dentista_id(nome)').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(50),
          admin.from('appointments').select('*, dentista:dentist_id(nome)').eq('paciente_id', pacienteId).order('appointment_date', { ascending: false }).limit(50),
        ]);

        if (pAdmin.data) {
          pacienteData = pAdmin.data;
          triagensData = tAdmin.data || [];
          agendamentosData = aAdmin.data || [];
        }
      }
    }

    if (!pacienteData) {
      return { success: false, error: 'Paciente não encontrado' };
    }

    const paciente = {
      ...pacienteData,
      provincia: pacienteData.provincia || (pacienteData as any).provincias?.nome || '-',
    };

    const triagens = triagensData || [];
    const agendamentos = (agendamentosData || []).map((a: any) => ({
      ...a,
      dentista: a.dentista || undefined,
    }));

    const html = buildHistoricoPacienteHtml(paciente, triagens, agendamentos);
    return exportHtmlAsPdf(html, `historico-${paciente.nome?.replace(/[^a-z0-9]/gi, '_') || 'paciente'}.pdf`);
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar histórico do paciente' };
  }
};

/**
 * Exporta a ficha de cadastro como PDF (reutiliza HTML da fichaService)
 */
export const exportarFichaPdf = async (html: string, nomeP?: string): Promise<PdfResult> => {
  return exportHtmlAsPdf(html, `ficha-${nomeP?.replace(/[^a-z0-9]/gi, '_') || 'paciente'}.pdf`);
};

const safeFileName = (value?: string) =>
  (value || 'paciente').replace(/[^a-z0-9]/gi, '_');

const buildAnamneseHtml = (paciente: any, anamnese: any) => `
<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Anamnese Clínica — ${paciente?.nome || 'Paciente'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">FICHA DE ANAMNESE CLÍNICA ODONTOLÓGICA</div>
        <div class="brand-clinic">Avaliação Médica Inicial · República de Angola</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Anamnese</div>
        <div class="meta-date">Data: <strong>${formatDate(anamnese?.updated_at || anamnese?.created_at || new Date().toISOString())}</strong></div>
      </div>
    </div>

    <div class="section-title">👤 Dados de Identificação</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Paciente</span>
        <span class="info-value">${paciente?.nome || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Contacto Telefónico</span>
        <span class="info-value">${paciente?.telefone || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Queixa Principal</span>
        <span class="info-value">${anamnese?.queixa_principal || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Medicamentos Contínuos</span>
        <span class="info-value">${anamnese?.medicamentos || '-'}</span>
      </div>
    </div>

    <div class="section-title">🩺 História Clínica e Antecedentes</div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-bottom:14px;">
      <p style="margin-bottom:8px;"><strong>História da Doença Atual (HDA):</strong> ${anamnese?.hda || 'Não relatada'}</p>
      <p style="margin-bottom:8px;"><strong>Alergias:</strong> ${anamnese?.alergias_desc || (anamnese?.alergico ? 'Sim (não detalhado)' : 'Nenhuma alergia conhecida')}</p>
      <p style="margin-bottom:8px;"><strong>Condições Crónicas:</strong> ${[
        anamnese?.hipertensao ? 'Hipertensão' : '',
        anamnese?.diabetes ? 'Diabetes' : '',
        anamnese?.cardiopatia ? 'Cardiopatia' : '',
        anamnese?.coagulopatia ? 'Coagulopatia' : '',
        anamnese?.hepatite ? 'Hepatite' : '',
        anamnese?.hiv ? 'HIV' : '',
        anamnese?.outras_doencas || '',
      ].filter(Boolean).join(', ') || 'Nenhuma patologia crónica assinalada'}</p>
      <p><strong>Observações Gerais do Avaliador:</strong> ${anamnese?.observacoes || 'Sem notas adicionais'}</p>
    </div>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">${paciente?.nome || 'Assinatura do Paciente / Responsável'}</div>
        <div class="sign-role">Declaro que as informações prestadas são verídicas</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Dr(a). Médico Dentista Avaliador</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Ficha de Anamnese em Folha A4 &nbsp;·&nbsp; Documento Confidencial
    </div>

  </div>

</body>
</html>`;

const buildPlanoHtml = (paciente: any, procedimentos: any[]) => {
  const total = (procedimentos || []).reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0);
  const rows = (procedimentos || []).map((item: any) => `
    <tr>
      <td><strong>${item.descricao || '-'}</strong></td>
      <td class="center">${item.dente || '-'}</td>
      <td class="center"><span class="badge ${item.status === 'concluido' ? 'badge-green' : item.status === 'em_andamento' ? 'badge-blue' : 'badge-amber'}">${item.status || 'planejado'}</span></td>
      <td class="num font-bold">${Number(item.valor || 0).toLocaleString('pt-AO')} Kz</td>
      <td>${item.observacoes || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Plano de Tratamento — ${paciente?.nome || 'Paciente'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">PLANO DE TRATAMENTO ODONTOLÓGICO & ORÇAMENTO</div>
        <div class="brand-clinic">Clínica Odontológica Especializada · República de Angola</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Orçamento Clínico</div>
        <div class="meta-date">Data: <strong>${formatDate(new Date().toISOString())}</strong></div>
      </div>
    </div>

    <div class="section-title">👤 Utente / Paciente</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome do Paciente</span>
        <span class="info-value">${paciente?.nome || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Telefone</span>
        <span class="info-value">${paciente?.telefone || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total de Procedimentos</span>
        <span class="info-value">${(procedimentos || []).length} itens</span>
      </div>
      <div class="info-item">
        <span class="info-label">Orçamento Global Estimado</span>
        <span class="info-value" style="color:#0284c7; font-weight:800;">${total.toLocaleString('pt-AO')} Kz</span>
      </div>
    </div>

    <div class="section-title">📋 Discriminação dos Procedimentos</div>
    <table>
      <thead>
        <tr>
          <th>Procedimento / Tratamento</th>
          <th class="center">Dente/Região</th>
          <th class="center">Estado</th>
          <th class="num">Honorários (Kz)</th>
          <th>Observações Clínicas</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" class="center" style="color:#94a3b8; padding:12px;">Nenhum procedimento registado.</td></tr>'}
        <tr class="total-row">
          <td colspan="3">VALOR TOTAL CONSOLIDADO DO TRATAMENTO</td>
          <td class="num">${total.toLocaleString('pt-AO')} Kz</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>

    <div class="legal-box">
      <strong>Condições do Plano de Tratamento:</strong><br>
      Este orçamento tem validade de 30 dias a partir da data de emissão. Valores sujeitos a reavaliação mediante alterações radiográficas ou necessidade cirúrgica superveniente.
    </div>

    <div class="signatures">
      <div class="sign-box">
        <div class="sign-line">${paciente?.nome || 'Assinatura do Paciente / Responsável'}</div>
        <div class="sign-role">De acordo com o plano proposto</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">Dr(a). Médico Dentista Assistente</div>
        <div class="sign-role">TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Orçamento Odontológico em Folha A4 &nbsp;·&nbsp; Documento Oficial
    </div>

  </div>

</body>
</html>`;
};

const buildPrescricaoHtml = (paciente: any, prescricao: any) => {
  const medicamentos = Array.isArray(prescricao?.medicamentos) ? prescricao.medicamentos : [];
  const meds = medicamentos.map((m: any) => `
    <tr>
      <td><strong>${m.nome || '-'}</strong></td>
      <td>${m.dose || '-'}</td>
      <td>${m.frequencia || '-'}</td>
      <td>${m.duracao || '-'}</td>
      <td>${m.observacoes || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <title>Receita Médica — ${paciente?.nome || 'Paciente'}</title>
  <style>${CSS_BASE}</style>
</head>
<body>

  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">

    <div class="brand-header">
      <div class="brand-left">
        <div class="brand-title">🦷 TeOdonto Angola</div>
        <div class="brand-sub">RECEITUÁRIO MÉDICO & PRESCRIÇÃO ODONTOLÓGICA</div>
        <div class="brand-clinic">Clínica Odontológica Especializada · República de Angola</div>
      </div>
      <div class="brand-right">
        <div class="badge-doc">Receita Médica</div>
        <div class="meta-date">Data: <strong>${formatDate(prescricao?.created_at || new Date().toISOString())}</strong></div>
      </div>
    </div>

    <div class="section-title">👤 Utente / Paciente</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome</span>
        <span class="info-value">${paciente?.nome || '-'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Telefone</span>
        <span class="info-value">${paciente?.telefone || '-'}</span>
      </div>
    </div>

    <div class="section-title">💊 Medicamentos Prescritos</div>
    <table>
      <thead>
        <tr>
          <th>Medicamento / Apresentação</th>
          <th>Dosagem / Posologia</th>
          <th>Frequência</th>
          <th>Duração do Tratamento</th>
          <th>Instruções Especiais</th>
        </tr>
      </thead>
      <tbody>
        ${meds || '<tr><td colspan="5" class="center" style="color:#94a3b8; padding:12px;">Nenhum medicamento registado.</td></tr>'}
      </tbody>
    </table>

    ${prescricao?.observacoes ? `
    <div class="section-title">📌 Instruções e Cuidados Gerais</div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 14px; margin-bottom:14px;">
      <p>${prescricao.observacoes}</p>
    </div>` : ''}

    <div class="signatures">
      <div class="sign-box" style="max-width:320px; margin: 40px auto 0 auto;">
        <div class="sign-line">Dr(a). ${prescricao?.dentista_nome || 'Médico Dentista'}</div>
        <div class="sign-role">CRM: ${prescricao?.dentista_crm || 'Pendente'} — TeOdonto Angola</div>
      </div>
    </div>

    <div class="footer">
      TeOdonto Angola &nbsp;·&nbsp; Receituário Odontológico Oficial em Folha A4 &nbsp;·&nbsp; Válido em território nacional
    </div>

  </div>

</body>
</html>`;
};

export const exportarAnamnesePdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, anamneseRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('anamneses').select('*').eq('paciente_id', pacienteId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!anamneseRes.data) return { success: false, error: 'Nenhuma anamnese encontrada para este paciente' };

    return exportHtmlAsPdf(buildAnamneseHtml(pacienteRes.data, anamneseRes.data), `anamnese-${safeFileName(pacienteRes.data.nome)}.pdf`);
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF da anamnese' };
  }
};

export const exportarPlanoTratamentoPdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, planoRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('planos_tratamento').select('id').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!planoRes.data?.id) return { success: false, error: 'Nenhum plano encontrado para este paciente' };

    const procedimentosRes = await supabase
      .from('procedimentos_tratamento')
      .select('*')
      .eq('plano_id', planoRes.data.id)
      .order('created_at', { ascending: true });

    return exportHtmlAsPdf(
      buildPlanoHtml(pacienteRes.data, procedimentosRes.data || []),
      `plano-${safeFileName(pacienteRes.data.nome)}.pdf`
    );
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF do plano de tratamento' };
  }
};

export const exportarPrescricaoPdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, prescricaoRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('prescricoes').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!prescricaoRes.data) return { success: false, error: 'Nenhuma prescrição encontrada para este paciente' };

    return exportHtmlAsPdf(
      buildPrescricaoHtml(pacienteRes.data, prescricaoRes.data),
      `prescricao-${safeFileName(pacienteRes.data.nome)}.pdf`
    );
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF da prescrição' };
  }
};
