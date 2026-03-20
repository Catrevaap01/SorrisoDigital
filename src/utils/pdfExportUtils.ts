import { Platform } from 'react-native';

type PdfResult = { success: boolean; error?: string };

const DEFAULT_WEB_PRINT_TIMEOUT_MS = 15000;

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
        @page {
          size: A4;
          margin: 15mm;
        }
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          background: #fff;
        }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
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
  const matches = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];
  const uniqueUrls = [...new Set(matches.map((match) => match[1]).filter(Boolean))];

  if (uniqueUrls.length === 0) {
    return html;
  }

  let output = html;

  for (const imageUrl of uniqueUrls) {
    if (
      imageUrl.startsWith('data:') ||
      imageUrl.startsWith('blob:') ||
      imageUrl.startsWith('file:')
    ) {
      continue;
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      output = output.split(imageUrl).join(dataUrl);
    } catch (error) {
      console.warn(`PDF: nao foi possivel embutir imagem ${imageUrl}`, error);
    }
  }

  return output;
};

const printInHiddenIframe = async (html: string): Promise<PdfResult> => {
  return await new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    };

    const finish = (result: PdfResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        success: false,
        error:
          'O navegador nao conseguiu abrir a impressao em tempo util. Tente novamente.',
      });
    }, DEFAULT_WEB_PRINT_TIMEOUT_MS);

    iframe.onload = () => {
      try {
        const printWindow = iframe.contentWindow;
        const doc = iframe.contentDocument || printWindow?.document;

        if (!printWindow || !doc) {
          finish({ success: false, error: 'Falha ao preparar o PDF no navegador.' });
          return;
        }

        const images = Array.from(doc.images || []);
        const waitImages = Promise.all(
          images.map(
            (image) =>
              new Promise<void>((imageResolve) => {
                if (image.complete) {
                  imageResolve();
                  return;
                }
                image.onload = () => imageResolve();
                image.onerror = () => imageResolve();
              })
          )
        );

        waitImages
          .catch(() => undefined)
          .finally(() => {
            const afterPrint = () => {
              printWindow.removeEventListener('afterprint', afterPrint);
              finish({ success: true });
            };

            printWindow.addEventListener('afterprint', afterPrint);
            printWindow.focus();
            printWindow.print();

            window.setTimeout(() => {
              finish({ success: true });
            }, 2000);
          });
      } catch (error: any) {
        finish({
          success: false,
          error: error?.message || 'Erro ao abrir a impressao do PDF.',
        });
      }
    };

    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      finish({ success: false, error: 'Falha ao preparar o documento para PDF.' });
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
  });
};

export const exportHtmlAsPdf = async (
  html: string,
  filename?: string
): Promise<PdfResult> => {
  try {
    const htmlDocument = buildHtmlDocument(html);
    const printableHtml = await inlineRemoteImages(htmlDocument);

    if (Platform.OS === 'web') {
      const result = await printInHiddenIframe(printableHtml);
      if (!result.success) {
        return result;
      }

      return { success: true };
    }

    const PrintModule = require('expo-print');
    const SharingModule = require('expo-sharing');

    const printToFileAsync =
      PrintModule.printToFileAsync || PrintModule.default?.printToFileAsync;
    const isAvailableAsync =
      SharingModule.isAvailableAsync || SharingModule.default?.isAvailableAsync;
    const shareAsync = SharingModule.shareAsync || SharingModule.default?.shareAsync;

    if (!printToFileAsync) {
      return { success: false, error: 'expo-print nao disponivel.' };
    }

    const { uri } = await printToFileAsync({
      html: printableHtml,
      width: 595,
      height: 842,
      base64: false,
    });

    if (!uri) {
      return { success: false, error: 'Nao foi possivel gerar o arquivo PDF.' };
    }

    if (isAvailableAsync && shareAsync) {
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: filename || 'Documento PDF',
          UTI: 'com.adobe.pdf',
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao gerar PDF.' };
  }
};
