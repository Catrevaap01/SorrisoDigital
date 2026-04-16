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
  dentistaNome: string,
  responsavelRole: string = 'dentista'
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
      padding: 10mm;
      color: #333;
      line-height: 1.3;
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      background: white;
      overflow: hidden;
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 2px solid #1E88E5;
    }
    .logo { font-size: 22px; font-weight: bold; color: #1E88E5; }
    .subtitle { color: #666; margin-top: 2px; font-size: 12px; }

    .badge { 
      display: inline-block;
      background: #E3F2FD;
      color: #1565C0;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 5px;
    }

    .section {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 10px;
      margin: 8px 0;
    }
    .section h3 {
      margin: 0 0 8px 0;
      color: #1E88E5;
      font-size: 15px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 10px;
      color: #888;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }
    .credentials-box {
      background: linear-gradient(135deg, #E3F2FD, #BBDEFB);
      padding: 10px;
      border-radius: 10px;
      border-left: 5px solid #1E88E5;
      margin: 8px 0;
    }
    .credentials-box h3 {
      margin: 0 0 6px 0;
      color: #1565C0;
      font-size: 15px;
    }
    .credential-row {
      margin-bottom: 8px;
    }
    .credential-label {
      font-size: 10px;
      color: #1976D2;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .credential-value {
      display: block;
      font-size: 20px;
      font-family: 'Courier New', Courier, monospace;
      font-weight: 800;
      background: #FFFFFF;
      padding: 8px 12px;
      border: 2px solid #1E88E5;
      border-radius: 8px;
      margin-top: 2px;
      color: #000000;
      letter-spacing: 1px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .credential-note {
      font-size: 10px;
      color: #666;
      margin-top: 4px;
      font-style: italic;
    }

    .qr-section {
      text-align: center;
      margin: 5px 0;
      padding: 8px;
      background: #FAFAFA;
      border-radius: 10px;
      border: 1px dashed #1E88E5;
    }
    .qr-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 2px;
      color: #1565C0;
    }
    .qr-subtitle {
      font-size: 9px;
      color: #888;
      margin-bottom: 4px;
    }
    .qr-code {
      width: 100px;
      height: 100px;
      margin: 0 auto;
      border-radius: 8px;
    }
    .qr-url {
      font-family: 'Courier New', monospace;
      font-size: 9px;
      color: #1E88E5;
      margin-top: 4px;
      word-break: break-all;
    }

    .steps-box {
      background: #fcfcfc;
      padding: 8px;
      border-radius: 10px;
      margin: 8px 0;
      border: 1px solid #eee;
    }
    .step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 2px;
    }
    .step-text { 
      font-size: 11px; 
      color: #666; 
      line-height: 1.2;
    }
    .step-text strong { color: #333; }

    .dentista-info {
      background: #E8F5E8;
      padding: 8px;
      border-radius: 10px;
      margin: 8px 0;
      text-align: center;
      font-size: 12px;
    }
    .dentista-info strong { color: #2E7D32; }

    .footer {
      margin-top: 10px;
      text-align: center;
      color: #999;
      font-size: 9px;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }

    @media print {
      body { margin: 0; padding: 5mm; }
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

  <div class="credentials-box">
    <h3>🔑 Credenciais de Acesso</h3>
    <div class="credential-row">
      <span class="credential-label">Email</span>
      <span class="credential-value" style="font-size: 18px; letter-spacing: 1px;">${tempEmail}</span>
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
      <img src="${qrDataUri}" alt="QR Code Instalar App" style="width: 120px; height: 120px; display: block; border-radius: 4px;">
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
    <strong>🩺 ${responsavelRole === 'secretario' ? 'Secretário' : 'Dentista'} Responsável:</strong> ${dentistaNome}<br>
    Este paciente foi cadastrado para atendimento odontológico.
  </div>

  <div class="footer">
    <p>TeOdonto Angola - Sistema Digital de Odontologia</p>
    <p>ID: ${paciente.id} | Documento confidencial</p>
  </div>
</body>
</html>`;
};
