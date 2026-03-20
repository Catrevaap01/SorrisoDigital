/**
 * Servico de Relatorios
 * Gera relatorios de dentistas e triagens
 */

import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../config/supabase';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
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
  totalPacientes: number;
  dentistasAtivos: number;
  totalTriagens: number;
  totalConsultas?: number;
  totalMensagens?: number;
  triagensRespondidas: number;
  percentualResposta: number;
  // novos campos para resumo do mês atual
  cadastrosMes?: number;
  dentistasMes?: number;
  pacientesMes?: number;
  
  dentistas: RelatorioDentista[];
  dataGeracao: string;
}

export interface ExportResult {
  success: boolean;
  fileUri?: string;
  error?: string;
}

/**
 * Gera relatorio geral de todos os dentistas
 */
export const gerarRelatorioGeral = async (): Promise<{
  success: boolean;
  data?: RelatorioGeral;
  error?: string;
}> => {
  try {
    const dataAgora = new Date();
    const inicioMes = new Date(dataAgora.getFullYear(), dataAgora.getMonth(), 1).toISOString();

    const [
      { data: dentistas, error: dentistasError },
      { count: totalPacientes, error: pacientesError },
      { data: triagens, error: triagensError }, // We still need this for per-dentist stats
      { count: consultasCount, error: consultasError },
      { count: mensagensCount, error: mensagensError },
      { count: dentistasMesCount, error: dentistasMesError },
      { count: pacientesMesCount, error: pacientesMesError },
    ] = await Promise.all([
      // 1. Listagem de dentistas (campos essenciais)
      supabase
        .from('profiles')
        .select('id, nome, email, especialidade, crm, created_at')
        .eq('tipo', 'dentista')
        .order('nome', { ascending: true }),
      
      // 2. Total de pacientes (só contagem)
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tipo', 'paciente'),
      
      // 3. Triagens (apenas campos para estatísticas)
      supabase.from('triagens').select('dentista_id, status, updated_at'),
      
      // 4. Consultas (só contagem)
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }),
      
      // 5. Mensagens (só contagem)
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      
      // 6. Dentistas do mês (só contagem)
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('tipo', 'dentista')
        .gte('created_at', inicioMes),
        
      // 7. Pacientes do mês (só contagem)
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('tipo', 'paciente')
        .gte('created_at', inicioMes),
    ]);

    if (dentistasError) return { success: false, error: dentistasError.message };
    if (pacientesError) return { success: false, error: pacientesError.message };
    if (triagensError) return { success: false, error: triagensError.message };
    if (consultasError) return { success: false, error: consultasError.message };
    if (mensagensError) return { success: false, error: mensagensError.message };
    if (dentistasMesError) return { success: false, error: dentistasMesError.message };
    if (pacientesMesError) return { success: false, error: pacientesMesError.message };

    const relatoriosDentistas: RelatorioDentista[] = (dentistas || []).map(
      (dentista: any) => {
        const triagensDentista = (triagens || []).filter(
          (t: any) => t.dentista_id === dentista.id
        );

        const respondidas = triagensDentista.filter(
          (t: any) => t.status === 'respondido' || t.status === 'completo'
        );

        const percentual =
          triagensDentista.length > 0
            ? (respondidas.length / triagensDentista.length) * 100
            : 0;

        const ultimaAtividade =
          triagensDentista.length > 0
            ? new Date(
                Math.max(
                  ...triagensDentista.map((t: any) => new Date(t.updated_at).getTime())
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
      totalTriagens > 0 ? (totalRespondidas / totalTriagens) * 100 : 0;

    // calcular metrics do mês atual
    // const dataAgora = new Date(); // Already defined
    // const inicioMes = new Date(dataAgora.getFullYear(), dataAgora.getMonth(), 1); // Now done on server
    // const perfisMes = [...(dentistas || []), ...(pacientes || [])].filter((p: any) => {
    //   const created = p?.created_at ? new Date(p.created_at) : null;
    //   return created && created >= inicioMes;
    // });
    // const dentistasMes = (dentistas || []).filter((d: any) => {
    //   const created = d?.created_at ? new Date(d.created_at) : null;
    //   return created && created >= inicioMes;
    // }).length;
    // const pacientesMes = (pacientes || []).filter((p: any) => {
    //   const created = p?.created_at ? new Date(p.created_at) : null;
    //   return created && created >= inicioMes;
    // }).length;

    // Log para debug (opcional, mas ajuda a ver se os dados estão chegando)
    console.log(`Relatório: ${dentistas?.length} dentistas, ${totalPacientes} pacientes. Novos no mês: ${dentistasMesCount}D, ${pacientesMesCount}P`);

    const relatorio: RelatorioGeral = {
      totalDentistas: dentistas?.length || 0,
      totalPacientes: Number(totalPacientes || 0),
      dentistasAtivos: relatoriosDentistas.filter((r) => r.totalTriagens > 0).length,
      totalTriagens,
      totalConsultas: Number(consultasCount || 0),
      totalMensagens: Number(mensagensCount || 0),
      triagensRespondidas: totalRespondidas,
      percentualResposta: Math.round(percentualGeral),
      cadastrosMes: (dentistasMesCount || 0) + (pacientesMesCount || 0),
      dentistasMes: dentistasMesCount || 0,
      pacientesMes: pacientesMesCount || 0,
      dentistas: relatoriosDentistas,
      dataGeracao: new Date().toISOString(),
    };

    return { success: true, data: relatorio };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao gerar relatorio',
    };
  }
};

/**
 * Gera relatorio detalhado de um dentista especifico
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
      // fallback para bancos legados que usam profile_id
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

    const estatisticas: RelatorioDentista = {
      dentista: dentista as DentistaProfile,
      totalTriagens: triagens.length,
      triagensRespondidas: respondidas.length,
      triagensPendentes: pendentes.length,
      percentualResposta: Math.round(percentual),
      dataUltimaAtividade: triagens.length > 0 ? triagens[0].updated_at : null,
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
          <h3>${relatorio.cadastrosMes || 0}</h3>
          <p>Cadastros mês</p>
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
