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
          const isRealizado = t.status === 'realizado' || t.agendamento_status === 'realizado' || (t.agendamentos && t.agendamentos.some((ag: any) => ag.status === 'realizado'));
          const statusLabel =
            isRealizado ? 'Realizado' :
            t.status === 'urgente' || t.prioridade === 'urgente' || Number(t.intensidade_dor || 0) >= 8 ? 'Urgente' :
            t.status === 'respondido' || (t.respostas && t.respostas.length > 0) ? 'Respondido' :
            t.status === 'pendente' ? 'Pendente' :
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
    <html lang="pt-AO">
    <head>
      <meta charset="utf-8">
      <title>Ficha de Histórico — ${paciente.nome}</title>
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
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 16px; }
        .logo-title { font-size: 20px; font-weight: 800; color: #0369a1; }
        .subtitle { color: #64748b; font-size: 11px; margin-top: 2px; }
        .paciente-info { background: #f8fafc; padding: 12px 14px; border-radius: 6px; margin: 14px 0; border: 1px solid #e2e8f0; }
        .info-row { display: flex; margin-bottom: 5px; font-size: 11.5px; }
        .info-label { font-weight: 700; color: #0284c7; min-width: 160px; font-size: 10.5px; text-transform: uppercase; }
        .info-value { flex: 1; color: #0f172a; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; page-break-inside: auto; }
        tr { page-break-inside: avoid; }
        th { background: #0284c7; color: white; padding: 7px 9px; text-align: left; font-size: 10px; font-weight: 700; }
        td { border-bottom: 1px solid #e2e8f0; padding: 7px 9px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .footer { margin-top: 28px; text-align: center; color: #94a3b8; font-size: 9px; border-top: 1px solid #e2e8f0; padding-top: 8px; page-break-inside: avoid; }
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
            <div class="subtitle">FICHA CLÍNICA DE HISTÓRICO — ${paciente.nome}</div>
          </div>
          <div style="text-align: right;">
            <div class="subtitle">Emissão: <strong>${dataGeracao}</strong></div>
            <div class="subtitle">ID: <strong>${(pacienteId || '').substring(0, 8)}</strong></div>
          </div>
        </div>

        <div class="paciente-info">
          <h3 style="margin-top: 0; color: #0369a1; font-size: 12px; text-transform: uppercase; margin-bottom: 8px;">Dados do Utente</h3>
          <div class="info-row">
            <span class="info-label">Nome Completo:</span>
            <span class="info-value">${paciente.nome}</span>
          </div>
          ${paciente.data_nascimento ? `<div class="info-row">
            <span class="info-label">Data de Nascimento:</span>
            <span class="info-value">${formatDateTime(paciente.data_nascimento)}</span>
          </div>` : ''}
          ${paciente.genero ? `<div class="info-row">
            <span class="info-label">Género:</span>
            <span class="info-value">${paciente.genero}</span>
          </div>` : ''}
          ${paciente.historico_medico ? `<div class="info-row">
            <span class="info-label">Histórico Médico:</span>
            <span class="info-value">${paciente.historico_medico}</span>
          </div>` : ''}
          ${paciente.alergias ? `<div class="info-row">
            <span class="info-label">Alergias:</span>
            <span class="info-value" style="color:#b91c1c;">${paciente.alergias}</span>
          </div>` : ''}
          ${paciente.medicamentos_atuais ? `<div class="info-row">
            <span class="info-label">Medicamentos Atuais:</span>
            <span class="info-value">${paciente.medicamentos_atuais}</span>
          </div>` : ''}
        </div>

        <h3 style="color: #0369a1; font-size: 12px; text-transform: uppercase; margin-top: 16px; margin-bottom: 6px;">Histórico de Triagens</h3>
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
          <p>TeOdonto Angola &nbsp;·&nbsp; Sistema Digital de Odontologia em Folha A4 &nbsp;·&nbsp; Documento Oficial</p>
          <p>ID Paciente: ${pacienteId}</p>
        </div>
      </div>
    </body>
    </html>`;
  } catch (error) {
    console.error('Erro ao gerar ficha:', error);
    throw error;
  }
};
