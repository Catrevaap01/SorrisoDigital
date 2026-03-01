import { gerarRelatorioDentista, gerarRelatorioGeral } from './relatorioService';
import { imprimirRelatorio } from './relatorioService';

// optional logo (base64 or public URL). Replace or configure as needed.
const LOGO_URL = 'https://teodontoangola.app/logo.png';

export type Orientation = 'portrait' | 'landscape';

type PdfResult = { success: boolean; error?: string };

const getPrintModules = () => {
  try {
    // Optional Expo modules
    // eslint-disable-next-line global-require
    const Print = require('expo-print');
    // eslint-disable-next-line global-require
    const Sharing = require('expo-sharing');
    return { Print, Sharing };
  } catch {
    return null;
  }
};

const buildGeneralHtml = (relatorio: any): string => {
  // group by specialty to create multi-layered sections
  const grouped: Record<string, any[]> = {};
  (relatorio.dentistas || []).forEach((d: any) => {
    const esp = d.dentista?.especialidade || 'Sem especialidade';
    if (!grouped[esp]) grouped[esp] = [];
    grouped[esp].push(d);
  });
  // compute totals (some may not be provided by relatorio.totais)
  const totals = {
    dentistas: relatorio.totalDentistas || 0,
    pacientes: relatorio.totalPacientes || 0,
    cadastros: (relatorio.totalDentistas || 0) + (relatorio.totalPacientes || 0),
    triagens: relatorio.totalTriagens || 0,
    respondidas: relatorio.triagensRespondidas || 0,
  };

  const groupRows = Object.entries(grouped)
    .map(([esp, items]) => {
      const subtotalTriagens = items.reduce((s, i) => s + (i.totalTriagens || 0), 0);
      const subtotalRespondidas = items.reduce((s, i) => s + (i.triagensRespondidas || 0), 0);
      const subtotalPendentes = items.reduce((s, i) => s + (i.triagensPendentes || 0), 0);
      const rows = items
        .map(
          (d: any) => `
      <tr>
        <td>${d.dentista?.nome || '-'}<\/td>
        <td>${d.dentista?.especialidade || '-'}<\/td>
        <td>${d.totalTriagens}<\/td>
        <td>${d.triagensRespondidas}<\/td>
        <td>${d.triagensPendentes}<\/td>
        <td>${d.percentualResposta}%<\/td>
      <\/tr>`
        )
        .join('');
      return `
      <tr><td colspan="6" style="background:#eee;font-weight:bold">Especialidade: ${esp}<\/td></tr>
      ${rows}
      <tr style="font-weight:bold;background:#fafafa">
        <td colspan="2">Subtotal<\/td>
        <td>${subtotalTriagens}<\/td>
        <td>${subtotalRespondidas}<\/td>
        <td>${subtotalPendentes}<\/td>
        <td><\/td>
      <\/tr>`;
    })
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 20mm; size: A4 portrait; }
        body { font-family: Arial; padding: 24px; color: #111; }
        header { display:flex; align-items:center; }
        header img { height: 50px; margin-right: 16px; }
        h1 { margin: 0; color: #1E88E5; }
        .meta { margin-top: 8px; color: #555; }
        .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 20px 0; }
        .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top:10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f7fa; }
        tbody tr:nth-child(even) { background: #f9f9f9; }
        footer { position: fixed; bottom: 0; width: 100%; font-size: 10px; text-align: right; color:#555; }
      <\/style>
    <\/head>
    <body>
      <header>
        <img src="${LOGO_URL}" alt="Logo" \/>
        <h1>Relatorio Geral<\/h1>
      <\/header>
      <div class="meta">Gerado em: ${new Date(relatorio.dataGeracao).toLocaleString('pt-PT')}<\/div>
      <div class="kpis">
        <div class="kpi">Total dentistas: <b>${relatorio.totalDentistas}<\/b><\/div>
        <div class="kpi">Total pacientes: <b>${relatorio.totalPacientes||0}<\/b><\/div>
        <div class="kpi">Total geral: <b>${totals.cadastros}<\/b><\/div>
        <div class="kpi">Dentistas ativos: <b>${relatorio.dentistasAtivos}<\/b><\/div>
        <div class="kpi">Total triagens: <b>${relatorio.totalTriagens}<\/b><\/div>
        <div class="kpi">Taxa resposta: <b>${relatorio.percentualResposta}%<\/b><\/div>
      <\/div>
      <table>
        <thead>
          <tr>
            <th>Nome<\/th>
            <th>Especialidade<\/th>
            <th>Triagens<\/th>
            <th>Respondidas<\/th>
            <th>Pendentes<\/th>
            <th>Taxa<\/th>
          <\/tr>
        <\/thead>
        <tbody>${groupRows}<\/tbody>
      <\/table>
      <footer>Totais: Dentistas ${totals.dentistas}, Pacientes ${totals.pacientes}, Geral ${totals.cadastros}, Triagens ${totals.triagens}, Respondidas ${totals.respondidas}<\/footer>
    <\/body>
  <\/html>`;
};

const buildDentistaHtml = (data: any): string => {
  const d = data.dentista;
  const e = data.estatisticas;
  const rows = (data.triagens || [])
    .slice(0, 80)
    .map(
      (t: any) => `
      <tr>
        <td>${new Date(t.created_at).toLocaleDateString('pt-PT')}</td>
        <td>${t.sintoma_principal || '-'}</td>
        <td>${t.status || '-'}</td>
        <td>${t.prioridade || '-'}</td>
      </tr>`
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { margin: 20mm; size: A4 ${'portrait'}; }
        body { font-family: Arial; padding: 24px; color: #111; }
        header { display:flex; align-items:center; }
        header img { height: 50px; margin-right: 16px; }
        h1 { margin: 0; color: #1E88E5; }
        .sub { margin-top: 8px; color: #555; }
        .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 20px 0; }
        .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top:10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f7fa; }
        tbody tr:nth-child(even) { background: #f9f9f9; }
        footer { position: fixed; bottom: 0; width: 100%; font-size: 10px; text-align: right; color:#555; }
      </style>
    </head>
    <body>
      <header>
        <img src="${LOGO_URL}" alt="Logo" />
        <h1>Relatorio do Dentista</h1>
      </header>
      <div class="sub">${d?.nome || '-'} (${d?.email || '-'})</div>
      <div class="kpis">
        <div class="kpi">Total triagens: <b>${e.totalTriagens}</b></div>
        <div class="kpi">Respondidas: <b>${e.triagensRespondidas}</b></div>
        <div class="kpi">Pendentes: <b>${e.triagensPendentes}</b></div>
        <div class="kpi">Taxa resposta: <b>${e.percentualResposta}%</b></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Sintoma</th>
            <th>Status</th>
            <th>Prioridade</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <footer>Dados do dentista: ${d?.nome || '-'} | Especialidade: ${d?.especialidade || '-'} | CRM: ${d?.crm || '-'}</footer>
    </body>
  </html>`;
};

const exportHtmlAsPdf = async (
  html: string,
  orientation: Orientation = 'portrait'
): Promise<PdfResult> => {
  const modules = getPrintModules();
  if (!modules) {
    const fallback = await imprimirRelatorio(html);
    if (fallback.success) {
      return { success: true };
    }
    return { success: false, error: fallback.error || 'Falha ao imprimir/compartilhar relatorio' };
  }

  try {
    const { uri } = await modules.Print.printToFileAsync({ html, orientation });
    const canShare = await modules.Sharing.isAvailableAsync();
    if (canShare) {
      await modules.Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
      return { success: true };
    }
    return { success: false, error: 'Compartilhamento de arquivo indisponivel no dispositivo' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao gerar PDF' };
  }
};

export const exportarRelatorioGeralPdf = async (
  orientation: Orientation = 'portrait'
): Promise<PdfResult> => {
  const result = await gerarRelatorioGeral();
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatorio geral' };
  }
  return exportHtmlAsPdf(buildGeneralHtml(result.data), orientation);
};

export const exportarRelatorioDentistaPdf = async (
  dentistaId: string,
  orientation: Orientation = 'portrait'
): Promise<PdfResult> => {
  const result = await gerarRelatorioDentista(dentistaId);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatorio do dentista' };
  }
  return exportHtmlAsPdf(buildDentistaHtml(result.data), orientation);
};
