import Constants from 'expo-constants';
import { PacienteProfile } from './pacienteService';
import { formatDateTime, formatDate } from '../utils/helpers';

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

  // ✅ QR points exactly to the Expo app installation link (Lido dinamicamente do app.json)
  const qrContent = Constants.expoConfig?.extra?.APK_DOWNLOAD_URL || 'https://expo.dev/@antoniotati/TeOdontoAngola';
  
  // Use api.qrserver.com for reliable QR image rendering in PDF
  const qrDataUri = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrContent)}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ficha de Cadastro — ${paciente.nome || 'Paciente'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: A4 portrait; 
      margin: 10mm;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #333;
      line-height: 1.35;
      background: #e2e8f0;
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
    .screen-toolbar-title {
      font-size: 12.5px;
      font-weight: 600;
      color: #cbd5e1;
    }
    .screen-toolbar-btn {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }
    .a4-container {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto 20px auto;
      background: white;
      padding: 14mm 16mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      border-radius: 3px;
    }
    @media print {
      body { background: white !important; }
      .screen-toolbar, .no-print { display: none !important; }
      .a4-container { width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
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
  <div class="screen-toolbar no-print">
    <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
    <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
  </div>

  <div class="a4-container">
    <div class="header">
      <div class="logo">🦷 TeOdonto Angola</div>
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
        <span class="info-value">${formatDate(paciente.data_nascimento)}</span>
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
    <p>ID: ${paciente.id} | Documento confidencial em Folha A4</p>
  </div>
  </div>
</body>
</html>`;
};
