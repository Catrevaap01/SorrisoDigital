module.exports = function(api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production';
  const plugins = [];

  if (isProduction) {
    // Remove console.* em produção — o metro minifier também faz isso,
    // mas remover ao nível do babel é mais eficiente (antes do bundling)
    try {
      require.resolve('babel-plugin-transform-remove-console');
      plugins.push(['transform-remove-console', { exclude: [] }]);
    } catch {
      // Plugin não instalado — o metro minifier (drop_console) ainda aplica
    }
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
