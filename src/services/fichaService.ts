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

  // QR aponta diretamente para a PWA onde o paciente pode instalar e fazer login
  const qrContent = `${APP_URL}`;

  // Use Google Charts for reliable QR image in PDF (no deps needed)
  const qrDataUri = `https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=${encodeURIComponent(qrContent)}&choe=UTF-8&chld=M|2`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 30px;
      color: #333;
      line-height: 1.5;
      max-width: 800px;
      margin: auto;
      background: white;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #1E88E5;
    }
    .logo { font-size: 32px; font-weight: bold; color: #1E88E5; }
    .subtitle { color: #666; margin-top: 8px; font-size: 16px; }

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
      margin: 24px 0;
      padding: 24px;
      background: #FAFAFA;
      border-radius: 12px;
      border: 2px dashed #1E88E5;
    }
    .qr-title {
      font-weight: 700;
      font-size: 18px;
      margin-bottom: 6px;
      color: #1565C0;
    }
    .qr-subtitle {
      font-size: 13px;
      color: #888;
      margin-bottom: 16px;
    }
    .qr-code {
      width: 220px;
      height: 220px;
      margin: 0 auto;
      border-radius: 8px;
    }
    .qr-url {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #1E88E5;
      margin-top: 12px;
      word-break: break-all;
    }
    .qr-instrucoes {
      font-size: 12px;
      color: #666;
      margin-top: 14px;
      line-height: 1.6;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }
    .qr-instrucoes strong { color: #333; }

    .steps-box {
      background: #E8F5E9;
      padding: 20px;
      border-radius: 12px;
      margin: 20px 0;
    }
    .steps-box h3 {
      color: #2E7D32;
      margin: 0 0 12px 0;
      font-size: 17px;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .step-num {
      width: 28px;
      height: 28px;
      background: #43A047;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }
    .step-text { font-size: 14px; color: #333; padding-top: 3px; }

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
    <div class="qr-title">📲 QR Code - Instalar o App</div>
    <div class="qr-subtitle">Escaneie com a câmera do celular</div>
    <img src="${qrDataUri}" alt="QR Code Instalar App" class="qr-code">
    <div class="qr-url">${qrContent}</div>
    <div class="qr-instrucoes">
      <strong>Escaneie este QR</strong> com a câmera do seu celular para abrir o app no navegador.
      Após abrir, toque em <strong>"Instalar"</strong> ou <strong>"Adicionar à tela inicial"</strong> para usá-lo como aplicativo.
    </div>
  </div>

  <div class="steps-box">
    <h3>📖 Instruções para Instalar e Usar</h3>
    <div class="step">
      <span class="step-num">1</span>
      <span class="step-text"><strong>Escaneie o QR Code</strong> acima com a câmera do celular</span>
    </div>
    <div class="step">
      <span class="step-num">2</span>
      <span class="step-text">No navegador, toque em <strong>"Instalar"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
    </div>
    <div class="step">
      <span class="step-num">3</span>
      <span class="step-text">Abra o app e faça login com o <strong>email e senha</strong> desta ficha</span>
    </div>
    <div class="step">
      <span class="step-num">4</span>
      <span class="step-text">Altere a sua senha no menu <strong>Perfil</strong> para mais segurança</span>
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
