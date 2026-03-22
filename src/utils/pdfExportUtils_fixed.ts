import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type PdfResult = { success: boolean; error?: string };

const buildHtmlDocument = (html: string): string => {
  const isFullHtml =
    html.trim().toLowerCase().startsWith('<!doctype') ||
    html.trim().toLowerCase().startsWith('<html');

  if (isFullHtml) {
    return html;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @page { size: A4; margin: 15mm; }
        html, body { margin: 0; padding: 0; width: 100%; background: #fff; }
        body { font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter imagem para base64.'));
    reader.readAsDataURL(blob);
  });

const inlineRemoteImages = async (html: string): Promise<string> => {
  const matches = [...html.matchAll(/<img\\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  const uniqueUrls = [...new Set(matches.map((match) => match[1]).filter(Boolean))];

  if (uniqueUrls.length === 0) {
    return html;
  }

  let output = html;
  let failedImages = 0;

  for (const imageUrl of uniqueUrls) {
    if (imageUrl.includes('chart.googleapis.com/chart')) {
      console.warn('PDF: Skipping Google QR for SVG replacement:', imageUrl);
      continue;
    }

    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:') || imageUrl.startsWith('file:')) {
      continue;
    }

    try {
      const response = await fetch(imageUrl, { mode: 'no-cors', cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      output = output.split(imageUrl).join(dataUrl);
    } catch (error) {
      console.warn(`PDF: Imagem falhou ${imageUrl}:`, error);
      failedImages++;
    }
  }

  console.log(`PDF: Inline imagens concluído (${failedImages} falharam)`);
  return output;
};

const DEFAULT_WEB_PRINT_TIMEOUT_MS = 10000;

const webPrintFallback = async (html: string, filename: string): Promise<PdfResult> => {
  if (Platform.OS !== 'web') throw new Error('Web only');
  
  try {
    const finalHtml = await inlineRemoteImages(html);
    
    const printTab = window.open('', '_blank');
    if (!printTab) return { success: false, error: 'Não foi possível abrir guia de impressão' };
    
    printTab.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>${filename}</title>
      <style>
        body { margin: 0; font-family: Arial, sans-serif; padding: 20px; }
        @media print { body { padding: 0; } }
        .print-btn { position: fixed; top: 10px; right: 10px; z-index: 9999; background: #1E88E5; color: white; padding: 10px 20px; border-radius: 25px; font-weight: bold; border: none; cursor: pointer; }
      </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print();">🖨️ Imprimir PDF</button>
        <div style="max-width: 210mm; margin: auto;">${finalHtml}</div>
      </body>
      </html>
    `);
    printTab.document.close();
    printTab.focus();
    
    setTimeout(() => printTab.print(), 1000);
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const exportHtmlAsPdf = async (
  html: string,
  filename = 'ficha-paciente.pdf'
): Promise<PdfResult> => {
  try {
    const htmlDocument = buildHtmlDocument(html);
    
    if (Platform.OS === 'web') {
      const popupResult = await printInNewWindow(htmlDocument, filename);
      if (popupResult.success) return popupResult;
      console.warn('Popup falhou, usando fallback:', popupResult.error);
      return webPrintFallback(htmlDocument, filename);
    }

    const printableHtml = await inlineRemoteImages(htmlDocument);
    const { uri } = await Print.printToFileAsync({
      html: printableHtml,
      width: 595, height: 842,
    });

    if (!uri) return { success: false, error: 'Falha geração PDF mobile' };

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('PDF Export failed:', err);
    return { success: false, error: err.message || 'Erro PDF' };
  }
};

const printInNewWindow = async (html: string, filename: string): Promise<PdfResult> => {
  return new Promise((resolve) => {
    const printWindow = window.open('', '_blank', 'width=850,height=1100,scrollbars=yes');
    
    if (!printWindow) {
      resolve({ success: false, error: 'Popup bloqueado. Clique "Permitir" no navegador.' });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${filename}</title></head>
      <body style="font-family:Arial;text-align:center;padding:50px;background:#f0f8ff;">
        <h2>🦷 Carregando...</h2>
        <p>Imagens sendo otimizadas (2-3s)</p>
      </body></html>
    `);
    printWindow.document.close();

    const timeoutId = window.setTimeout(() => {
      printWindow.close();
      resolve({ success: false, error: 'Timeout carregamento' });
    }, DEFAULT_WEB_PRINT_TIMEOUT_MS);

    setTimeout(async () => {
      try {
        const finalHtml = await inlineRemoteImages(html);
        printWindow.document.open();
        printWindow.document.write(finalHtml);
        printWindow.document.close();
        
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
          printWindow.document.title = filename;
          clearTimeout(timeoutId);
          resolve({ success: true });
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        resolve({ success: false, error: 'Erro HTML: ' + error });
      }
    }, 300);
  });
};

