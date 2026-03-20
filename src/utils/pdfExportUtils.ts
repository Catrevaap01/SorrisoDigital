/**
 * Utilitário de exportação HTML → PDF
 * Funciona tanto em web quanto mobile
 */

import { Platform } from 'react-native';

type PdfResult = { success: boolean; error?: string };

/**
 * Exporta HTML como PDF — web usa impressão/download, mobile usa expo-print/sharing
 */
export const exportHtmlAsPdf = async (
  html: string,
  filename?: string
): Promise<PdfResult> => {
  // Se o HTML já começa com <!DOCTYPE ou <html, não envolvemos novamente
  const isFullHtml = html.trim().toLowerCase().startsWith('<!doctype') || 
                    html.trim().toLowerCase().startsWith('<html');
  
  const htmlA4 = isFullHtml ? html : `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 20mm; }
        body { margin: 0; padding: 0; width: 100%; font-family: sans-serif; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  // WEB: Abre janela de impressão (funciona como "Salvar PDF" no Chrome/Edge)
  if (Platform.OS === 'web') {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        // Fallback: download como HTML
        const blob = new Blob([htmlA4], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'relatorio.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true };
      }
      printWindow.document.write(htmlA4);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        // Não fechamos a janela automaticamente para dar tempo do print dialog abrir
      }, 500);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao gerar PDF na web' };
    }
  }

  // MOBILE: usa expo-print + expo-sharing
  try {
    const PrintModule = require('expo-print');
    const SharingModule = require('expo-sharing');

    const printToFileAsync = PrintModule.printToFileAsync || PrintModule.default?.printToFileAsync;
    const isAvailableAsync = SharingModule.isAvailableAsync || SharingModule.default?.isAvailableAsync;
    const shareAsync = SharingModule.shareAsync || SharingModule.default?.shareAsync;

    if (!printToFileAsync) {
      return { success: false, error: 'expo-print não disponível' };
    }

    // A4: 595.28 x 841.89 points (72dpi)
    const { uri } = await printToFileAsync({ 
      html: htmlA4,
      width: 595,
      height: 842 
    });

    if (isAvailableAsync && shareAsync) {
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: filename || 'Documento PDF',
          UTI: 'com.adobe.pdf'
        });
        return { success: true };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF' };
  }
};
