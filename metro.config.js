const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Otimizações para reduzir tamanho do bundle e evitar erros de memória
config.resolver.assetExts.push(
  // Adicionar extensões de fontes
  'ttf',
  'otf',
  'woff',
  'woff2'
);

// Configurações de otimização
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
  output: {
    comments: false,
    ascii_only: true,
  },
  compress: {
    drop_console: false,
    drop_debugger: true,
    pure_funcs: [
      'console.log',
      'console.info',
      'console.debug',
      'console.warn'
    ],
  },
};

// Aumentar limite de memória para o Metro
config.maxWorkers = 2;

// Configurações de cache
config.cacheStores = [];

module.exports = config;
