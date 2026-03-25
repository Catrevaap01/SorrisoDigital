import Constants from 'expo-constants';
import { PacienteProfile } from './pacienteService';
import { formatDateTime } from '../utils/helpers';

const APP_URL = Constants.expoConfig?.extra?.APP_URL || 'https://teodontoangola.vercel.app';

/**
 * Gera HTML da ficha de cadastro do paciente com credenciais e QR Code
 * QR aponta para a URL real da PWA para o paciente instalar o app
 */
export const gerarFichaCadastroHTML = async (
  paciente: PacienteProfile,
  tempEmail: string,
  tempPassword: string,
  dentistaNome: string
): Promise<string> => {
  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // ✅ QR points to Login with auto-fill params for "permitir ter acesso ao ler o qr"
  const qrContent = `${APP_URL}/login?email=${encodeURIComponent(tempEmail)}&password=${encodeURIComponent(tempPassword)}`;
  
  // Use Google Charts for reliable QR image in PDF
  const qrDataUri = `https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=${encodeURIComponent(qrContent)}&choe=UTF-8&chld=M|2`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: A4; 
      margin: 0; /* Let body padding handle margin */
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 15mm;
      color: #333;
      line-height: 1.4;
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      background: white;
      overflow: hidden;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 3px solid #1E88E5;
    }
    .logo { font-size: 28px; font-weight: bold; color: #1E88E5; }
    .subtitle { color: #666; margin-top: 4px; font-size: 14px; }

    .badge { 
      display: inline-block;
      background: #E3F2FD;
      color: #1565C0;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      margin-top: 8px;
    }

    .section {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      margin: 16px 0;
    }
    .section h3 {
      margin: 0 0 14px 0;
      color: #1E88E5;
      font-size: 17px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 12px;
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      font-size: 15px;
      color: #333;
      font-weight: 500;
    }

    .credentials-box {
      background: linear-gradient(135deg, #E3F2FD, #BBDEFB);
      padding: 24px;
      border-radius: 12px;
      border-left: 5px solid #1E88E5;
      margin: 20px 0;
    }
    .credentials-box h3 {
      margin: 0 0 16px 0;
      color: #1565C0;
      font-size: 17px;
    }
    .credential-row {
      margin-bottom: 14px;
    }
    .credential-label {
      font-size: 12px;
      color: #1976D2;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .credential-value {
      display: block;
      font-size: 32px;
      font-family: 'Courier New', Courier, monospace;
      font-weight: 800;
      background: #FFFFFF;
      padding: 16px 20px;
      border: 3px solid #1E88E5;
      border-radius: 12px;
      margin-top: 8px;
      color: #000000;
      letter-spacing: 3px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .credential-note {
      font-size: 12px;
      color: #666;
      margin-top: 10px;
      font-style: italic;
    }

    .qr-section {
      text-align: center;
      margin: 15px 0;
      padding: 15px;
      padding-top: 10px;
      background: #FAFAFA;
      border-radius: 12px;
      border: 2px dashed #1E88E5;
    }
    .qr-title {
      font-weight: 700;
      font-size: 16px;
      margin-bottom: 2px;
      color: #1565C0;
    }
    .qr-subtitle {
      font-size: 11px;
      color: #888;
      margin-bottom: 10px;
    }
    .qr-code {
      width: 140px; /* Reduced for A4 balance */
      height: 140px;
      margin: 0 auto;
      border-radius: 8px;
    }
    .qr-url {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #1E88E5;
      margin-top: 8px;
      word-break: break-all;
    }
    .qr-instrucoes {
      font-size: 11px;
      color: #666;
      margin-top: 8px;
      line-height: 1.4;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }
    .qr-instrucoes strong { color: #333; }

    .steps-box {
      background: #fcfcfc;
      padding: 15px;
      border-radius: 12px;
      margin: 15px 0;
      border: 1px solid #eee;
    }
    .step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .step-text { 
      font-size: 13px; 
      color: #666; 
      line-height: 1.4;
    }
    .step-text strong { color: #333; }

    .dentista-info {
      background: #E8F5E8;
      padding: 16px;
      border-radius: 12px;
      margin: 20px 0;
      text-align: center;
      font-size: 14px;
    }
    .dentista-info strong { color: #2E7D32; }

    .footer {
      margin-top: 40px;
      text-align: center;
      color: #999;
      font-size: 11px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }

    @media print {
      body { margin: 0; padding: 15px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🦷 Odontologia de Angola</div>
    <div class="subtitle">Ficha de Cadastro do Paciente</div>
    <div class="badge">📋 Gerado em: ${dataGeracao}</div>
  </div>

  <div class="section">
    <h3>👤 Dados do Paciente</h3>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Nome Completo</span>
        <span class="info-value">${paciente.nome}</span>
      </div>
      ${paciente.telefone ? `
      <div class="info-item">
        <span class="info-label">Telefone</span>
        <span class="info-value">${paciente.telefone}</span>
      </div>` : ''}
      ${paciente.data_nascimento ? `
      <div class="info-item">
        <span class="info-label">Data Nascimento</span>
        <span class="info-value">${formatDateTime(paciente.data_nascimento)}</span>
      </div>` : ''}
      ${paciente.genero ? `
      <div class="info-item">
        <span class="info-label">Gênero</span>
        <span class="info-value">${paciente.genero}</span>
      </div>` : ''}
      ${paciente.provincia ? `
      <div class="info-item">
        <span class="info-label">Província</span>
        <span class="info-value">${paciente.provincia}</span>
      </div>` : ''}
    </div>
  </div>

  ${(paciente.historico_medico || paciente.alergias || paciente.medicamentos_atuais || paciente.observacoes_gerais) ? `
  <div class="section">
    <h3>🏥 Informações Clínicas</h3>
    <div class="info-grid">
      ${paciente.historico_medico ? `
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Histórico Médico</span>
        <span class="info-value">${paciente.historico_medico}</span>
      </div>` : ''}
      ${paciente.alergias ? `
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label" style="color: #d32f2f;">Alergias (Importante)</span>
        <span class="info-value" style="color: #d32f2f; font-weight: 700;">${paciente.alergias}</span>
      </div>` : ''}
      ${paciente.medicamentos_atuais ? `
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Medicações em Uso</span>
        <span class="info-value">${paciente.medicamentos_atuais}</span>
      </div>` : ''}
      ${paciente.observacoes_gerais ? `
      <div class="info-item" style="grid-column: span 2;">
        <span class="info-label">Observações Gerais</span>
        <span class="info-value">${paciente.observacoes_gerais}</span>
      </div>` : ''}
    </div>
  </div>` : ''}

  <div class="credentials-box">
    <h3>🔑 Credenciais de Acesso</h3>
    <div class="credential-row">
      <span class="credential-label">Email</span>
      <span class="credential-value">${tempEmail}</span>
    </div>
    <div class="credential-row">
      <span class="credential-label">Senha Temporária</span>
      <span class="credential-value">${tempPassword.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
    </div>
    <div class="credential-note">
      ⚠️ Altere a senha após o primeiro login para segurança da sua conta.
    </div>
  </div>

  <div class="qr-section">
    <div class="qr-title">📲 QR - Instalar o App</div>
    <div class="qr-subtitle">Escaneie com a câmera do celular</div>
    <div style="display: inline-block; padding: 10px; border: 2px solid #1E88E5; border-radius: 12px; background: white; margin-bottom: 8px;">
      <img src="${qrDataUri}" alt="QR Code Instalar App" style="width: 140px; height: 140px; display: block; border-radius: 4px;">
    </div>
    <div class="qr-url">${qrContent}</div>
  </div>

  <div class="steps-box">
    <div class="step">
      <span class="step-text">1. Escaneie o QR Code com a câmera do celular</span>
    </div>
    <div class="step">
      <span class="step-text">2. No navegador, toque em <strong>"Instalar"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
    </div>
    <div class="step">
      <span class="step-text">3. Abra o app e faça login com o <strong>email e senha</strong> desta ficha</span>
    </div>
    <div class="step">
      <span class="step-text">4. Altere a sua senha no menu <strong>Perfil</strong> para mais segurança</span>
    </div>
  </div>

  <div class="dentista-info">
    <strong>🩺 Dentista Responsável:</strong> ${dentistaNome}<br>
    Este paciente foi cadastrado para atendimento odontológico.
  </div>

  <div class="footer">
    <p>TeOdonto Angola - Sistema Digital de Odontologia</p>
    <p>ID: ${paciente.id} | Documento confidencial</p>
  </div>
</body>
</html>`;
};
