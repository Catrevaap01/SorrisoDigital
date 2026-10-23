const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

const config = getDefaultConfig(__dirname);

// ── 1. Resolver — extensões de assets ──────────────────────────────────────────
config.resolver.assetExts.push('ttf', 'otf', 'woff', 'woff2');

// ── 2. Workers ───────────────────────────────────────────────────────────────
const cpuCount = os.cpus()?.length || 4;
config.maxWorkers = Math.min(Math.max(2, cpuCount - 1), 6);

// ── 3. Transformer — inline requires ─────────────────────────────────────────
config.transformer.inlineRequires = true;

module.exports = config;
