@echo off
REM ============================================================
REM  Script para configurar TUDO de uma vez
REM  Execute com: setup_reminders.bat
REM ============================================================

SET PROJECT_REF=yyscwmcghokyzhtcluif

echo.
echo ========================================
echo  TeOdonto Angola - Setup de Lembretes
echo ========================================
echo.

REM ── 1. Verificar se Supabase CLI está instalado ──
where supabase >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Supabase CLI nao encontrado. Instalando via npm...
    npm install -g supabase
)

echo.
echo [1/4] Fazendo login no Supabase...
echo       (Se ja estiver logado, pode ignorar)
supabase login

echo.
echo [2/4] Linkando projecto %PROJECT_REF%...
supabase link --project-ref %PROJECT_REF%

echo.
echo [3/4] Configurando Secrets da Edge Function...
echo.

REM ── RESEND ──
SET /P RESEND_KEY="Digite a RESEND_API_KEY (https://resend.com/api-keys): "
if not "%RESEND_KEY%"=="" (
    echo %RESEND_KEY%| supabase secrets set RESEND_API_KEY=%RESEND_KEY% --project-ref %PROJECT_REF%
    echo    [OK] RESEND_API_KEY configurada
)

REM ── FROM EMAIL ──
SET /P FROM_EMAIL="Digite o FROM_EMAIL (ex: Sorriso Digital <no-reply@seudominio.com>): "
if not "%FROM_EMAIL%"=="" (
    supabase secrets set "FROM_EMAIL=%FROM_EMAIL%" --project-ref %PROJECT_REF%
    echo    [OK] FROM_EMAIL configurado
)

REM ── WHATSAPP (opcional) ──
SET /P WA_TOKEN="WhatsApp API Token (ENTER para pular): "
if not "%WA_TOKEN%"=="" (
    supabase secrets set WHATSAPP_API_TOKEN=%WA_TOKEN% --project-ref %PROJECT_REF%
    echo    [OK] WHATSAPP_API_TOKEN configurado
)

SET /P WA_PHONE="WhatsApp Phone Number ID (ENTER para pular): "
if not "%WA_PHONE%"=="" (
    supabase secrets set WHATSAPP_PHONE_NUMBER_ID=%WA_PHONE% --project-ref %PROJECT_REF%
    echo    [OK] WHATSAPP_PHONE_NUMBER_ID configurado
)

echo.
echo [4/4] Fazendo deploy das Edge Functions...
supabase functions deploy send-email --project-ref %PROJECT_REF%
supabase functions deploy send-reminders --project-ref %PROJECT_REF%

echo.
echo ========================================
echo  SETUP CONCLUIDO!
echo ========================================
echo.
echo Proximos passos manuais:
echo  1. Abra o Supabase SQL Editor
echo  2. Execute: docs/REMINDER_CRON_SETUP.sql
echo  3. (Opcional) Execute: docs/REMINDER_LOG_SETUP.sql
echo.
pause
