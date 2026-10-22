import { Platform } from 'react-native';

type PdfResult = { success: boolean; error?: string };

const A4_STYLES = `
  @page {
    size: A4 portrait;
    margin: 12mm 15mm 15mm 15mm;
  }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    background: #f1f5f9;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.45;
    font-size: 11.5px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .screen-toolbar {
    width: 210mm;
    max-width: calc(100% - 24px);
    margin: 16px auto 14px auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  }
  .screen-toolbar-title {
    font-size: 13px;
    font-weight: 600;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 8px;
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: background 0.2s;
  }
  .screen-toolbar-btn:hover {
    background: #0369a1;
  }
  .a4-container {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 30px auto;
    background: #ffffff;
    padding: 16mm 18mm;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.12);
    border-radius: 3px;
    box-sizing: border-box;
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    html, body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .screen-toolbar, .no-print {
      display: none !important;
    }
    .a4-container {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;
    }
  }
`;

const buildHtmlDocument = (html: string, title?: string): string => {
  const isFullHtml =
    html.trim().toLowerCase().startsWith('<!doctype') ||
    html.trim().toLowerCase().startsWith('<html');

  if (isFullHtml) {
    // If it's already full HTML, ensure print-color-adjust and A4 page rules are enforced
    let enhanced = html;
    if (!enhanced.includes('@page')) {
      enhanced = enhanced.replace(
        /<\/head>/i,
        `<style>${A4_STYLES}</style></head>`
      );
    }
    return enhanced;
  }

  const hasContainer = html.includes('a4-container');
  const hasToolbar = html.includes('screen-toolbar');

  const docTitle = title || 'Documento Oficial — TeOdonto Angola';

  const toolbarHtml = hasToolbar
    ? ''
    : `
    <div class="screen-toolbar no-print">
      <div class="screen-toolbar-title">📄 Folha A4 Oficial &nbsp;·&nbsp; TeOdonto Angola</div>
      <button class="screen-toolbar-btn" onclick="window.print()">🖨️ Imprimir / Guardar em PDF (A4)</button>
    </div>
  `;

  const bodyContent = hasContainer ? html : `<div class="a4-container">${html}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <style>
    ${A4_STYLES}
  </style>
</head>
<body>
  ${toolbarHtml}
  ${bodyContent}
</body>
</html>`;
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

const openInA4PrintWindow = (html: string, filename?: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    if (filename && printWindow.document) {
      printWindow.document.title = filename.replace(/\.pdf$/i, '');
    }
    printWindow.focus();

    // Dispara a impressão/salvar como PDF após o documento carregar
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (err) {
        console.warn('PDF: Auto-print no popup:', err);
      }
    }, 700);

    return true;
  } catch (err) {
    console.warn('PDF: Falha ao abrir janela de impressão A4:', err);
    return false;
  }
};

const showInPageA4Modal = (html: string, filename?: string): Promise<PdfResult> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ success: false, error: 'Documento não disponível' });
      return;
    }

    // Remove sobreposição pré-existente se houver
    const existing = document.getElementById('teodonto-a4-preview-overlay');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const overlay = document.createElement('div');
    overlay.id = 'teodonto-a4-preview-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,0.85);overflow-y:auto;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;';

    const inner = document.createElement('div');
    inner.style.cssText =
      'width:100%;max-width:215mm;display:flex;flex-direction:column;align-items:center;';

    const cleanTitle = filename ? filename.replace(/\.pdf$/i, '') : 'Documento TeOdonto';

    const topBar = document.createElement('div');
    topBar.className = 'no-print';
    topBar.style.cssText =
      'width:100%;max-width:210mm;background:#0f172a;border-radius:8px;padding:12px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;color:#fff;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    topBar.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:#cbd5e1;display:flex;align-items:center;gap:6px;">
        📄 Folha A4 &nbsp;·&nbsp; ${cleanTitle}
      </div>
      <div style="display:flex;gap:10px;">
        <button id="btn-print-overlay" style="background:#0284c7;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          🖨️ Imprimir / Guardar PDF (A4)
        </button>
        <button id="btn-close-overlay" style="background:#475569;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;">
          ✖ Fechar
        </button>
      </div>
    `;

    const frameContainer = document.createElement('div');
    frameContainer.style.cssText = 'width:100%;display:flex;justify-content:center;';

    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'width:210mm;max-width:100%;min-height:297mm;border:none;background:#fff;border-radius:4px;box-shadow:0 8px 30px rgba(0,0,0,0.25);';
    frameContainer.appendChild(iframe);

    inner.appendChild(topBar);
    inner.appendChild(frameContainer);
    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    const close = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve({ success: true });
    };

    topBar.querySelector('#btn-close-overlay')?.addEventListener('click', close);
    topBar.querySelector('#btn-print-overlay')?.addEventListener('click', () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    });

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        setTimeout(() => {
          try {
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('PDF: Auto-print no iframe do modal:', e);
          }
        }, 600);
      } catch (e) {
        console.warn('PDF: Iframe load error:', e);
      }
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  });
};

export const exportHtmlAsPdf = async (
  html: string,
  filename?: string
): Promise<PdfResult> => {
  try {
    const htmlDocument = buildHtmlDocument(html, filename);
    const printableHtml = await inlineRemoteImages(htmlDocument);

    if (Platform.OS === 'web') {
      // 1. Tenta abrir em nova aba dedicada com layout de folha A4 oficial
      const opened = openInA4PrintWindow(printableHtml, filename);
      if (opened) {
        return { success: true };
      }

      // 2. Fallback caso pop-ups estejam bloqueados (ou seja PWA standalone / Mobile Web):
      // Exibe modal em alta resolução vetorial com A4 na tela e dispara impressão nativa
      return await showInPageA4Modal(printableHtml, filename);
    }

    // Mobile Nativo (Android / iOS via Expo):
    const PrintModule = require('expo-print');
    const SharingModule = require('expo-sharing');

    const printToFileAsync =
      PrintModule.printToFileAsync || PrintModule.default?.printToFileAsync;
    const isAvailableAsync =
      SharingModule.isAvailableAsync || SharingModule.default?.isAvailableAsync;
    const shareAsync = SharingModule.shareAsync || SharingModule.default?.shareAsync;

    if (!printToFileAsync) {
      return { success: false, error: 'expo-print não disponível.' };
    }

    // A4 padrão internacional: 595.28 x 841.89 pontos a 72 DPI (vector)
    const { uri } = await printToFileAsync({
      html: printableHtml,
      width: 595,
      height: 842,
      base64: false,
    });

    if (!uri) {
      return { success: false, error: 'Não foi possível gerar o arquivo PDF.' };
    }

    if (isAvailableAsync && shareAsync) {
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: filename || 'Documento PDF Oficial',
          UTI: 'com.adobe.pdf',
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao gerar PDF.' };
  }
};
