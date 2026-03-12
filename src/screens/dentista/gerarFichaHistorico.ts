import { buscarPaciente } from '../../services/pacienteService';
import { buscarTriagensPaciente } from '../../services/triagemService';
import { formatDateTime } from '../../utils/helpers';

interface SafePaciente {
  nome: string;
  data_nascimento?: string;
  genero?: string;
  historico_medico?: string;
  alergias?: string;
  medicamentos_atuais?: string;
}

export const gerarFichaHistorico = async (pacienteId: string): Promise<string> => {
  try {
    const [pResult, tResult] = await Promise.all([
      buscarPaciente(pacienteId),
      buscarTriagensPaciente(pacienteId)
    ]);

    const pacienteRaw = pResult.data || { nome: 'Paciente não encontrado' };
    const paciente: SafePaciente = {
      nome: pacienteRaw.nome || 'Paciente não encontrado',
      data_nascimento: (pacienteRaw as any).data_nascimento,
      genero: (pacienteRaw as any).genero,
      historico_medico: (pacienteRaw as any).historico_medico,
      alergias: (pacienteRaw as any).alergias,
      medicamentos_atuais: (pacienteRaw as any).medicamentos_atuais,
    };

    const triagens = tResult.data || [];

    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const triagemRows = triagens
      .map((t: any) => {
        const statusLabel = t.status === 'pendente' ? 'Pendente' :
                           t.status === 'em_analise' ? 'Em Análise' :
                           t.status === 'concluida' ? 'Concluída' : t.status;
        return `
        <tr>
          <td>${t.id.substring(0, 6)}</td>
          <td>${formatDateTime(t.created_at)}</td>
          <td>${t.sintoma_principal || '-'}</td>
          <td>${t.intensidade_dor || '-'}</td>
          <td>${statusLabel}</td>
        </tr>`;
      })
      .join('') || '<tr><td colspan="5" style="text-align:center;">Nenhuma triagem encontrada</td></tr>';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1E88E5; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #1E88E5; }
        .subtitle { color: #666; margin-top: 8px; font-size: 16px; }
        .paciente-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .info-row { display: flex; margin-bottom: 10px; }
        .info-label { font-weight: bold; color: #1E88E5; min-width: 140px; }
        .info-value { flex: 1; }
        .period { background: #e3f2fd; padding: 12px; border-radius: 6px; margin: 20px 0; text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #1E88E5; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .status { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        .status.pendente { background: #FF9800; color: white; }
        .status.em_analise { background: #2196F3; color: white; }
        .status.concluida { background: #4CAF50; color: white; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
        @media print { body { margin: 0; padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🦷 TeOdonto Angola</div>
        <div class="subtitle">Ficha Completa de Histórico - ${paciente.nome}</div>
      </div>
      
      <div class="period">
        <strong>Ficha de Histórico do Paciente</strong><br>
        Gerado em: ${dataGeracao}
      </div>

      <div class="paciente-info">
        <h3 style="margin-top: 0; color: #1E88E5;">Informações do Paciente</h3>
        <div class="info-row">
          <span class="info-label">Nome:</span>
          <span class="info-value">${paciente.nome}</span>
        </div>
        ${paciente.data_nascimento ? `<div class="info-row">
          <span class="info-label">Data de Nascimento:</span>
          <span class="info-value">${formatDateTime(paciente.data_nascimento)}</span>
        </div>` : ''}
        ${paciente.genero ? `<div class="info-row">
          <span class="info-label">Gênero:</span>
          <span class="info-value">${paciente.genero}</span>
        </div>` : ''}
        ${paciente.historico_medico ? `<div class="info-row">
          <span class="info-label">Histórico Médico:</span>
          <span class="info-value">${paciente.historico_medico}</span>
        </div>` : ''}
        ${paciente.alergias ? `<div class="info-row">
          <span class="info-label">Alergias:</span>
          <span class="info-value">${paciente.alergias}</span>
        </div>` : ''}
        ${paciente.medicamentos_atuais ? `<div class="info-row">
          <span class="info-label">Medicamentos Atuais:</span>
          <span class="info-value">${paciente.medicamentos_atuais}</span>
        </div>` : ''}
      </div>

      <h3>Histórico de Triagens</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Data/Hora</th>
            <th>Sintoma Principal</th>
            <th>Intensidade Dor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${triagemRows}
        </tbody>
      </table>

      <div class="footer">
        <p>Este documento foi gerado automaticamente pelo sistema TeOdonto Angola</p>
        <p>ID Paciente: ${pacienteId}</p>
      </div>
    </body>
    </html>`;
  } catch (error) {
    console.error('Erro ao gerar ficha:', error);
    throw error;
  }
};
