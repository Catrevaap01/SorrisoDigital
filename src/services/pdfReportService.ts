import { gerarRelatorioDentista, gerarRelatorioGeral } from './relatorioService';
import { imprimirRelatorio } from './relatorioService';

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
  const rows = (relatorio.dentistas || [])
    .map(
      (d: any) => `
      <tr>
        <td>${d.dentista?.nome || '-'}</td>
        <td>${d.dentista?.especialidade || '-'}</td>
        <td>${d.totalTriagens}</td>
        <td>${d.triagensRespondidas}</td>
        <td>${d.triagensPendentes}</td>
        <td>${d.percentualResposta}%</td>
      </tr>`
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial; padding: 24px; color: #111; }
        h1 { margin: 0; color: #1E88E5; }
        .meta { margin-top: 8px; color: #555; }
        .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 20px 0; }
        .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f7fa; }
      </style>
    </head>
    <body>
      <h1>Relatorio Geral</h1>
      <div class="meta">Gerado em: ${new Date(relatorio.dataGeracao).toLocaleString('pt-PT')}</div>
      <div class="kpis">
        <div class="kpi">Total dentistas: <b>${relatorio.totalDentistas}</b></div>
        <div class="kpi">Total cadastros mês: <b>${relatorio.cadastrosMes || 0}</b></div>
        <div class="kpi">Dentistas mês: <b>${relatorio.dentistasMes || 0}</b></div>
        <div class="kpi">Pacientes mês: <b>${relatorio.pacientesMes || 0}</b></div>
        <div class="kpi">Dentistas ativos: <b>${relatorio.dentistasAtivos}</b></div>
        <div class="kpi">Total triagens: <b>${relatorio.totalTriagens}</b></div>
        <div class="kpi">Taxa resposta: <b>${relatorio.percentualResposta}%</b></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Especialidade</th>
            <th>Triagens</th>
            <th>Respondidas</th>
            <th>Pendentes</th>
            <th>Taxa</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
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
        body { font-family: Arial; padding: 24px; color: #111; }
        h1 { margin: 0; color: #1E88E5; }
        .sub { margin-top: 8px; color: #555; }
        .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 20px 0; }
        .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f7fa; }
      </style>
    </head>
    <body>
      <h1>Relatorio do Dentista</h1>
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
    </body>
  </html>`;
};

const exportHtmlAsPdf = async (html: string): Promise<PdfResult> => {
  const modules = getPrintModules();
  if (!modules) {
    const fallback = await imprimirRelatorio(html);
    if (fallback.success) {
      return { success: true };
    }
    return {
      success: false,
      error:
        fallback.error ||
        'PDF indisponivel neste ambiente. Instale expo-print/expo-sharing para exportar PDF.',
    };
  }

  try {
    const { uri } = await modules.Print.printToFileAsync({ html });
    const canShare = await modules.Sharing.isAvailableAsync();
    if (canShare) {
      await modules.Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
      });
      return { success: true };
    }
    const fallback = await imprimirRelatorio(html);
    if (fallback.success) {
      return { success: true };
    }
    return {
      success: false,
      error:
        'Compartilhamento de PDF indisponivel no dispositivo. Use exportacao HTML/CSV.',
    };
  } catch (error: any) {
    const fallback = await imprimirRelatorio(html);
    if (fallback.success) {
      return { success: true };
    }
    return { success: false, error: error.message || 'Erro ao gerar PDF' };
  }
};

export const exportarRelatorioGeralPdf = async (): Promise<PdfResult> => {
  const result = await gerarRelatorioGeral();
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatorio geral' };
  }
  return exportHtmlAsPdf(buildGeneralHtml(result.data));
};

export const exportarRelatorioDentistaPdf = async (
  dentistaId: string
): Promise<PdfResult> => {
  const result = await gerarRelatorioDentista(dentistaId);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatorio do dentista' };
  }
  return exportHtmlAsPdf(buildDentistaHtml(result.data));
};
