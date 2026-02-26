/**
 * Serviço de Relatórios
 * Gera relatórios de dentistas e triagens
 */

import { supabase } from '../config/supabase';
import { DentistaProfile } from './dentistaService';

export interface RelatorioDentista {
  dentista: DentistaProfile;
  totalTriagens: number;
  triagensRespondidas: number;
  triagensPendentes: number;
  percentualResposta: number;
  dataUltimaAtividade: string | null;
}

export interface RelatorioGeral {
  totalDentistas: number;
  dentistasAtivos: number;
  totalTriagens: number;
  triagensRespondidas: number;
  percentualResposta: number;
  dentistas: RelatorioDentista[];
  dataGeracao: string;
}

/**
 * Gera relatório geral de todos os dentistas
 */
export const gerarRelatorioGeral = async (): Promise<{
  success: boolean;
  data?: RelatorioGeral;
  error?: string;
}> => {
  try {
    // 1. Buscar todos os dentistas
    const { data: dentistas, error: dentistasError } = await supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'dentista')
      .order('nome', { ascending: true });

    if (dentistasError) {
      return { success: false, error: dentistasError.message };
    }

    // 2. Buscar todas triagens
    const { data: triagens, error: triagensError } = await supabase
      .from('triagens')
      .select('*, profile_id');

    if (triagensError) {
      return { success: false, error: triagensError.message };
    }

    // 3. Processar dados
    const relatoriosDentistas: RelatorioDentista[] = (dentistas || []).map(
      (dentista: any) => {
        const triagensDentista = (triagens || []).filter(
          (t: any) => t.profile_id === dentista.id
        );
        const respondidas = triagensDentista.filter(
          (t: any) => t.status === 'respondido' || t.status === 'completo'
        );
        const percentual =
          triagensDentista.length > 0
            ? (respondidas.length / triagensDentista.length) * 100
            : 0;

        const ultimaAtividade = triagensDentista.length > 0
          ? new Date(
              Math.max(
                ...triagensDentista.map((t: any) =>
                  new Date(t.updated_at).getTime()
                )
              )
            ).toISOString()
          : null;

        return {
          dentista: dentista as DentistaProfile,
          totalTriagens: triagensDentista.length,
          triagensRespondidas: respondidas.length,
          triagensPendentes: triagensDentista.length - respondidas.length,
          percentualResposta: Math.round(percentual),
          dataUltimaAtividade: ultimaAtividade,
        };
      }
    );

    const totalTriagens = triagens?.length || 0;
    const totalRespondidas = (triagens || []).filter(
      (t: any) => t.status === 'respondido' || t.status === 'completo'
    ).length;
    const percentualGeral =
      totalTriagens > 0
        ? (totalRespondidas / totalTriagens) * 100
        : 0;

    const relatorio: RelatorioGeral = {
      totalDentistas: dentistas?.length || 0,
      dentistasAtivos: relatoriosDentistas.filter(
        (r) => r.totalTriagens > 0
      ).length,
      totalTriagens,
      triagensRespondidas: totalRespondidas,
      percentualResposta: Math.round(percentualGeral),
      dentistas: relatoriosDentistas,
      dataGeracao: new Date().toISOString(),
    };

    return {
      success: true,
      data: relatorio,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatório',
    };
  }
};

/**
 * Gera relatório detalhado de um dentista específico
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
    // 1. Buscar dentista
    const { data: dentista, error: dentistaError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', dentistaId)
      .single();

    if (dentistaError) {
      return { success: false, error: 'Dentista não encontrado' };
    }

    // 2. Buscar triagens do dentista
    const { data: triagens, error: triagensError } = await supabase
      .from('triagens')
      .select('*')
      .eq('profile_id', dentistaId)
      .order('created_at', { ascending: false });

    if (triagensError) {
      return { success: false, error: triagensError.message };
    }

    // 3. Calcular estatísticas
    const respondidas = (triagens || []).filter(
      (t: any) => t.status === 'respondido' || t.status === 'completo'
    );
    const pendentes = (triagens || []).filter(
      (t: any) => t.status === 'pendente'
    );
    const percentual =
      triagens && triagens.length > 0
        ? (respondidas.length / triagens.length) * 100
        : 0;

    const estatisticas: RelatorioDentista = {
      dentista: dentista as DentistaProfile,
      totalTriagens: triagens?.length || 0,
      triagensRespondidas: respondidas.length,
      triagensPendentes: pendentes.length,
      percentualResposta: Math.round(percentual),
      dataUltimaAtividade:
        triagens && triagens.length > 0
          ? triagens[0].updated_at
          : null,
    };

    return {
      success: true,
      data: {
        dentista: dentista as DentistaProfile,
        estatisticas,
        triagens: triagens || [],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatório',
    };
  }
};

/**
 * Exporta relatório em formato JSON
 */
export const exportarRelatorioJSON = (
  relatorio: RelatorioGeral | any,
  filename: string = 'relatorio.json'
): void => {
  try {
    const dataStr = JSON.stringify(relatorio, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar JSON:', error);
  }
};

/**
 * Exporta relatório em formato CSV
 */
export const exportarRelatorioCSV = (
  relatorio: RelatorioGeral,
  filename: string = 'relatorio.csv'
): void => {
  try {
    let csv = 'Relatório Geral de Dentistas\n';
    csv += `Gerado em: ${new Date(relatorio.dataGeracao).toLocaleDateString('pt-AO')}\n\n`;
    csv += `Total de Dentistas,${relatorio.totalDentistas}\n`;
    csv += `Dentistas Ativos,${relatorio.dentistasAtivos}\n`;
    csv += `Total de Triagens,${relatorio.totalTriagens}\n`;
    csv += `Triagens Respondidas,${relatorio.triagensRespondidas}\n`;
    csv += `Percentual de Resposta,${relatorio.percentualResposta}%\n\n`;

    csv += 'Nome,Especialidade,Total Triagens,Respondidas,Pendentes,Taxa Resposta (%)\n';
    relatorio.dentistas.forEach((r) => {
      csv += `"${r.dentista.nome || ''}","${r.dentista.especialidade || ''}",${r.totalTriagens},${r.triagensRespondidas},${r.triagensPendentes},${r.percentualResposta}\n`;
    });

    const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
  }
};

/**
 * Prepara HTML para impressão do relatório
 */
export const gerarHTMLRelatorio = (relatorio: RelatorioGeral): string => {
  const dataBR = new Date(relatorio.dataGeracao).toLocaleDateString('pt-AO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let html = `
    <!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Geral - Te Odonto Angola</title>
      <style>
        * { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        body { padding: 40px; background: white; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #1E88E5; padding-bottom: 20px; }
        h1 { color: #1E88E5; font-size: 28px; }
        .subtitle { color: #666; font-size: 12px; margin-top: 5px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .summary-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { color: #1E88E5; font-size: 24px; }
        .summary-card p { color: #666; font-size: 12px; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        table th { background: #1E88E5; color: white; padding: 12px; text-align: left; font-weight: bold; }
        table td { padding: 12px; border-bottom: 1px solid #eee; }
        table tr:nth-child(even) { background: #f9f9f9; }
        .footer { text-align: center; margin-top: 40px; color: #999; font-size: 11px; }
        .page-break { page-break-after: always; }
        @media print {
          body { padding: 20px; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Te Odonto Angola</h1>
        <p class="subtitle">Relatório Geral de Dentistas</p>
        <p class="subtitle">Gerado em ${dataBR}</p>
      </div>

      <div class="summary">
        <div class="summary-card">
          <h3>${relatorio.totalDentistas}</h3>
          <p>Total de Dentistas</p>
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
          ${relatorio.dentistas.map((r) => `
            <tr>
              <td>${r.dentista.nome || '-'}</td>
              <td>${r.dentista.especialidade || '-'}</td>
              <td>${r.totalTriagens}</td>
              <td>${r.triagensRespondidas}</td>
              <td>${r.triagensPendentes}</td>
              <td>${r.percentualResposta}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <p>Este relatório foi gerado automaticamente pelo sistema Te Odonto Angola</p>
      </div>
    </body>
    </html>
  `;

  return html;
};

/**
 * Imprime o relatório
 */
export const imprimirRelatorio = (html: string): void => {
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  } catch (error) {
    console.error('Erro ao imprimir:', error);
  }
};
