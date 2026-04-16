import Constants from 'expo-constants';

const APP_URL = Constants.expoConfig?.extra?.APP_URL || 'https://teodontoangola.vercel.app';

/**
 * Gera URL para QR codes de acesso à aplicação
 */
export const gerarQrUrls = (pacienteId?: string, email?: string, password?: string) => {
  const urls = {
    // 1. Instalação genérica da app
    generica: `${APP_URL}`,
    
    // 2. Histórico específico do paciente
    historico: pacienteId ? `${APP_URL}/historico?pacienteId=${pacienteId}` : null,
    
    // 3. Auto-login (email/password prefill)
    login: email && password ? `${APP_URL}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}` : null,
  };
  
  return urls;
};

/**
 * Gera URL da imagem QR via Google Charts (funciona em HTML/PDF/WebView)
 * @param content Texto/URL para QR
 * @param size Tamanho em pixels (default 200x200)
 */
export const gerarQrImageUrl = (content: string, size = 200): string => {
  return `https://chart.googleapis.com/chart?` +
         `chs=${size}x${size}&` +
         `cht=qr&` +
         `chl=${encodeURIComponent(content)}&` +
         `choe=UTF-8&` +
         `chld=M|2`;
};

/**
 * Gera QR HTML embed (para PDF/HTML fichas)
 */
export const gerarQrHtml = (label: string, content: string, size = 120): string => {
  const qrUrl = gerarQrImageUrl(content, size);
  return `
    <div style="text-align: center; padding: 12px; border: 2px dashed #1E88E5; border-radius: 12px; background: #FCFCFC; margin: 10px 0;">
      <div style="font-weight: bold; margin-bottom: 8px; color: #1E88E5;">📲 ${label}</div>
      <img src="${qrUrl}" style="width: ${size}px; height: ${size}px; border-radius: 8px;" alt="${label}" />
      <div style="font-size: 10px; color: #666; word-break: break-all; margin-top: 6px;">${content}</div>
    </div>
  `;
};

