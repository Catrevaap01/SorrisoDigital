#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configurações de ambiente para otimizar memória
process.env.NODE_OPTIONS = '--max-old-space-size=4096';
process.env.EXPO_NO_DOTENV = '1';

// Limpar cache antes de compilar
function cleanCache() {
  try {
    console.log('Limpando cache...');
    if (fs.existsSync('.expo')) {
      execSync('rm -rf .expo', { stdio: 'inherit' });
    }
    if (fs.existsSync('node_modules/.cache')) {
      execSync('rm -rf node_modules/.cache', { stdio: 'inherit' });
    }
    console.log('Cache limpo com sucesso!');
  } catch (error) {
    console.log('Erro ao limpar cache:', error.message);
  }
}

// Compilar apenas para web (evita problemas do Hermes)
function buildWeb() {
  try {
    console.log('Iniciando compilação para web...');
    
    // Configurar variáveis de ambiente
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      EXPO_PUBLIC_WEB: 'true',
      EXPO_NO_DOTENV: '1'
    };

    // Compilar para web
    execSync('npx expo export --platform web', {
      stdio: 'inherit',
      env: env,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    console.log('Compilação web concluída com sucesso!');
    
    // Iniciar servidor de desenvolvimento
    console.log('Iniciando servidor web...');
    execSync('cd dist && npx serve -s -p 3000', {
      stdio: 'inherit',
      env: env
    });

  } catch (error) {
    console.error('Erro na compilação:', error.message);
    process.exit(1);
  }
}

// Executar processo
async function main() {
  console.log('=== Build Otimizado TeOdontoAngola ===');
  
  cleanCache();
  buildWeb();
}

main().catch(console.error);
