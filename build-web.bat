@echo off
echo === Build Web Otimizado TeOdontoAngola ===

REM Limpar cache
echo Limpando cache...
if exist .expo rmdir /s /q .expo
if exist node_modules\.cache rmdir /s /q node_modules\.cache

REM Configurar variáveis de ambiente
set NODE_OPTIONS=--max-old-space-size=4096
set NODE_ENV=production
set EXPO_PUBLIC_WEB=true
set EXPO_NO_DOTENV=1

REM Compilar apenas para web
echo Iniciando compilação para web...
npx expo export --platform web --clear-cache

REM Iniciar servidor web
echo Iniciando servidor web...
cd dist
npx serve -s -p 3000

pause
