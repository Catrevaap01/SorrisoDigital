const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

const config = getDefaultConfig(__dirname);

// ── 1. Resolver — extensões de assets ──────────────────────────────────────────
config.resolver.assetExts.push('ttf', 'otf', 'woff', 'woff2');

// ── 2. Workers — usar todos os núcleos disponíveis (mínimo 4, máximo cpus-1) ──
// ANTES: maxWorkers = 2 → subutilizava a CPU
const cpuCount = os.cpus().length;
config.maxWorkers = Math.min(Math.max(4, cpuCount - 1), 8);

// ── 3. Cache — NUNCA desactivar o cache do Metro ──────────────────────────────
// ANTES: cacheStores = [] → cada build começava do zero (muito lento!)
// Agora: cache padrão do Metro (FileStore em .metro-cache)
// NÃO definir cacheStores → Metro usa o cache padrão em disco

// ── 4. Minificação agressiva para produção ────────────────────────────────────
config.transformer.minifierConfig = {
  keep_classnames: false,
  keep_fnames: false,
  mangle: {
    keep_classnames: false,
    keep_fnames: false,
    toplevel: true,
  },
  output: {
    comments: false,
    ascii_only: true,
    beautify: false,
    wrap_iife: true,
  },
  compress: {
    drop_console: true,       // Remove console.* em produção
    drop_debugger: true,      // Remove debugger statements
    pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
    dead_code: true,          // Tree shaking
    passes: 2,                // 2 passos = melhor compressão
    collapse_vars: true,
    reduce_vars: true,
    unused: true,
  },
};

// ── 5. Transformer — inline requires para startup mais rápido ─────────────────
// O React Native carrega módulos apenas quando são necessários
config.transformer.inlineRequires = true;

module.exports = config;
