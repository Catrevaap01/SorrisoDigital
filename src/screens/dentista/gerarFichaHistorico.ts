import { PacienteProfile } from '../../services/pacienteService';
import { buscarPaciente } from '../../services/pacienteService';
import { buscarTriagensPaciente } from '../../services/triagemService';
import { formatDateTime } from '../../utils/helpers';

interface SafePaciente {
  nome: string;
  email?: string;
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
      buscarTriagensPaciente(pacienteId),
    ]);

    const pacienteRaw = pResult.data || { nome: 'Paciente não encontrado' };
    const paciente: SafePaciente = {
      nome: pacienteRaw.nome || 'Paciente não encontrado',
      email: (pacienteRaw as PacienteProfile).email,
      data_nascimento: (pacienteRaw as PacienteProfile).data_nascimento,
      genero: (pacienteRaw as PacienteProfile).genero,
      historico_medico: (pacienteRaw as PacienteProfile).historico_medico,
      alergias: (pacienteRaw as PacienteProfile).alergias,
      medicamentos_atuais: (pacienteRaw as PacienteProfile).medicamentos_atuais,
    };

    const triagens = tResult.data || [];

    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const triagemRows =
      triagens
        .map((t: any) => {
          const statusLabel =
            t.status === 'pendente' ? 'Pendente' :
            t.status === 'em_analise' ? 'Em Análise' :
            t.status === 'concluida' ? 'Concluída' :
            t.status;
          return `
          <tr>
            <td>${t.id.substring(0, 6)}</td>
            <td>${formatDateTime(t.created_at)}</td>
            <td>${t.sintoma_principal || '-'}</td>
            <td>${t.intensidade_dor || '-'}</td>
            <td>${statusLabel}</td>
          </tr>`;
        })
        .join('') ||
      '<tr><td colspan="5" style="text-align:center;">Nenhuma triagem encontrada</td></tr>';

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 10mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; line-height: 1.4; max-width: 210mm; margin: auto; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #1E88E5; padding-bottom: 15px; }
        .logo { font-size: 24px; font-weight: bold; color: #1E88E5; }
        .subtitle { color: #666; margin-top: 4px; font-size: 14px; }
        .paciente-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e0e0e0; }
        .info-row { display: flex; margin-bottom: 6px; font-size: 13px; }
        .info-label { font-weight: bold; color: #1E88E5; min-width: 150px; }
        .info-value { flex: 1; }
        .period { background: #e3f2fd; padding: 10px; border-radius: 6px; margin: 15px 0; text-align: center; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
        th { background: #1E88E5; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #eee; padding-top: 15px; }
        @media print { body { margin: 0; padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🦷 Odontologia Angola</div>
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
        <p>Este documento foi gerado automaticamente pelo sistema Odontologia Angola</p>
        <p>ID Paciente: ${pacienteId}</p>
      </div>
    </body>
    </html>`;
  } catch (error) {
    console.error('Erro ao gerar ficha:', error);
    throw error;
  }
};
