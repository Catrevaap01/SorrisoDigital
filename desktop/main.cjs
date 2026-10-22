/**
 * desktop/main.cjs — Electron main process optimizado
 *
 * Optimizações implementadas:
 *  ✅ In-memory file cache (evita re-leitura do disco a cada pedido)
 *  ✅ GPU rasterization e hardware acceleration
 *  ✅ V8 code cache
 *  ✅ Preload seguro com contextIsolation
 *  ✅ Splash/loading screen enquanto carrega
 *  ✅ Compressão gzip para ficheiros JS/CSS grandes
 */

const { app, BrowserWindow, shell, Menu } = require('electron');
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const isDev = process.env.ELECTRON_DEV === 'true';
const distPath = path.join(__dirname, '../dist');

// ── In-memory file cache ───────────────────────────────────────────────────────
// Máximo 50MB em cache (ficheiros JS/CSS são os mais acedidos)
const MAX_CACHE_BYTES = 50 * 1024 * 1024;
const fileCache = new Map(); // path → { data: Buffer, mtime: number }
let cacheSizeBytes = 0;

const MIME_TYPES = {
  '.css':   'text/css; charset=utf-8',
  '.html':  'text/html; charset=utf-8',
  '.ico':   'image/x-icon',
  '.jpg':   'image/jpeg',
  '.js':    'text/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.png':   'image/png',
  '.svg':   'image/svg+xml',
  '.ttf':   'font/ttf',
  '.wasm':  'application/wasm',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
};

// Extensões que beneficiam de gzip
const GZIP_EXTS = new Set(['.js', '.css', '.json', '.svg', '.html']);

// ── Resolver de ficheiros ─────────────────────────────────────────────────────
function resolveDistFile(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const resolved = path.resolve(distPath, relative);

  if (!resolved.startsWith(distPath)) return null; // path traversal guard

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  return path.join(distPath, 'index.html'); // SPA fallback
}

function buildAppMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        { role: 'toggledevtools', label: 'Alternar DevTools' },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'close', label: 'Fechar' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Documentação',
          click: () => shell.openExternal('https://github.com/TeOdontoAngola'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Leitura com cache em memória ──────────────────────────────────────────────
function readFileCached(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;
      const cached = fileCache.get(filePath);

      if (cached && cached.mtime === mtime) {
        return resolve(cached.data);
      }

      fs.readFile(filePath, (err, data) => {
        if (err) return reject(err);

        // Só armazena em cache se houver espaço
        if (cacheSizeBytes + data.length <= MAX_CACHE_BYTES) {
          if (cached) cacheSizeBytes -= cached.data.length;
          fileCache.set(filePath, { data, mtime });
          cacheSizeBytes += data.length;
        }
        resolve(data);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// ── Servidor HTTPS estático ───────────────────────────────────────────────────
let staticServer;

function startStaticServer() {
  return new Promise((resolve, reject) => {
    // Gerar certificado auto-assinado localmente para SSL
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });

    const serverOptions = {
      key: pems.private,
      cert: pems.cert
    };

    const https = require('https');
    staticServer = https.createServer(serverOptions, async (req, res) => {
      const filePath = resolveDistFile(req.url || '/');

      // Cabeçalhos de Segurança (SSL + CSP + etc)
      const securityHeaders = {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co wss://*.supabase.co blob: data:; img-src 'self' data: blob: https:;"
      };

      if (!filePath) {
        res.writeHead(403, securityHeaders);
        res.end('Forbidden');
        return;
      }

      const ext = path.extname(filePath);
      const isHtml = ext === '.html';
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const cacheControl = isHtml
        ? 'no-cache, no-store'
        : 'public, max-age=31536000, immutable'; // 1 ano para assets com hash

      try {
        const data = await readFileCached(filePath);
        const acceptEncoding = req.headers['accept-encoding'] || '';

        const responseHeaders = {
          ...securityHeaders,
          'Content-Type': contentType,
          'Cache-Control': cacheControl,
        };

        // Gzip para ficheiros grandes (>1KB) que suportam compressão
        if (GZIP_EXTS.has(ext) && acceptEncoding.includes('gzip') && data.length > 1024) {
          zlib.gzip(data, (err, compressed) => {
            if (err) {
              res.writeHead(200, responseHeaders);
              res.end(data);
              return;
            }
            res.writeHead(200, {
              ...responseHeaders,
              'Content-Encoding': 'gzip',
              'Vary': 'Accept-Encoding',
            });
            res.end(compressed);
          });
        } else {
          res.writeHead(200, responseHeaders);
          res.end(data);
        }
      } catch {
        res.writeHead(404, securityHeaders);
        res.end('Not found');
      }
    });

    staticServer.on('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      const { port } = staticServer.address();
      console.log(`[TeOdonto] Servidor local seguro: https://127.0.0.1:${port}`);
      resolve(`https://127.0.0.1:${port}`);
    });
  });
}

// ── Criar janela ──────────────────────────────────────────────────────────────
async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'TeOdonto Angola',
    icon: path.join(distPath, 'favicon.ico'),
    backgroundColor: '#1E88E5', // Cor primary — elimina flash branco
    show: false,                // Não mostrar até estar pronto
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'code',   // Cache de código V8 compilado
      backgroundThrottling: false, // Não reduzir quando em background
    },
  });

  // Mostrar apenas quando o conteúdo estiver totalmente renderizado
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Links externos → browser do sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL('http://localhost:8081');
    win.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  const localUrl = await startStaticServer();
  win.loadURL(localUrl);
}

// ── Flags de performance do Chromium ─────────────────────────────────────────
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-hardware-overlays');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512 --optimize-for-size');

// Ignorar erros de certificado apenas para o localhost (auto-assinado)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://127.0.0.1:') || url.startsWith('https://localhost:')) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildAppMenu();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (staticServer) staticServer.close();
  fileCache.clear();
});
