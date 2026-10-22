#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const distDir = path.join(root, 'dist');
const webDir = path.join(root, 'web');
const publicAssetsDir = path.join(distDir, 'assets');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const copyIfExists = (from, to) => {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
  return true;
};

const walkFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
};

if (!fs.existsSync(distDir)) {
  console.error('dist/ nao encontrado. Execute expo export antes de preparar o PWA.');
  process.exit(1);
}

ensureDir(publicAssetsDir);
copyIfExists(path.join(webDir, 'manifest.json'), path.join(distDir, 'manifest.json'));
copyIfExists(path.join(webDir, 'offline.html'), path.join(distDir, 'offline.html'));
copyIfExists(path.join(root, 'assets', 'icon.png'), path.join(publicAssetsDir, 'icon.png'));
copyIfExists(path.join(root, 'assets', 'favicon.png'), path.join(publicAssetsDir, 'favicon.png'));

const precacheAssets = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  ...walkFiles(path.join(distDir, '_expo')).map((file) => `/${path.relative(distDir, file).replace(/\\/g, '/')}`),
  ...walkFiles(publicAssetsDir).map((file) => `/${path.relative(distDir, file).replace(/\\/g, '/')}`),
  '/favicon.ico',
].filter((asset, index, list) => list.indexOf(asset) === index);

const sourceSwPath = path.join(webDir, 'service-worker.js');
const targetSwPath = path.join(distDir, 'service-worker.js');
let serviceWorker = fs.readFileSync(sourceSwPath, 'utf8');
serviceWorker = serviceWorker.replace(
  'self.__TEODONTO_PRECACHE_ASSETS__ || []',
  JSON.stringify(precacheAssets, null, 2)
);
fs.writeFileSync(targetSwPath, serviceWorker);

const indexPath = path.join(distDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('rel="manifest"')) {
  indexHtml = indexHtml.replace('</head>', '<link rel="manifest" href="/manifest.json" />\n</head>');
}
if (!indexHtml.includes('serviceWorker.register')) {
  indexHtml = indexHtml.replace(
    '</body>',
    `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js').catch(function (error) {
      console.warn('Service Worker falhou:', error);
    });
  });
}
</script>
</body>`
  );
}
fs.writeFileSync(indexPath, indexHtml);

console.log(`PWA preparado com ${precacheAssets.length} assets em cache.`);
