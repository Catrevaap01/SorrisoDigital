-- ============================================================
--  REMINDER CRON — TeOdonto Angola
--  Execução automática de lembretes 2x por dia
--
--  PRÉ-REQUISITOS (activar no Dashboard → Database → Extensions):
--    1. pg_cron
--    2. pg_net (para HTTP requests)
--
--  Execute este script DEPOIS de fazer deploy da Edge Function:
--    supabase functions deploy send-reminders
-- ============================================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remover jobs anteriores (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-morning');
EXCEPTION WHEN OTHERS THEN
  -- job não existe, continuar
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-evening');
EXCEPTION WHEN OTHERS THEN
  -- job não existe, continuar
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-reminders-midday');
EXCEPTION WHEN OTHERS THEN
  -- job não existe, continuar
END $$;

-- ============================================================
-- Job 1: 07:00 UTC (08:00 WAT Angola)
-- Captura consultas do dia seguinte logo de manhã
-- ============================================================
SELECT cron.schedule(
  'send-reminders-morning',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yyscwmcghokyzhtcluif.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5c2N3bWNnaG9reXpodGNsdWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2ODI5NiwiZXhwIjoyMDg3NjQ0Mjk2fQ.FwA-pcwih72mOv36lawPFYWhRb7BiKCQksITjrNzwFg"}'::jsonb,
    body := '{"triggered_by":"pg_cron_morning"}'::jsonb
  );
  $$
);

-- ============================================================
-- Job 2: 12:00 UTC (13:00 WAT Angola)
-- Redundância: captura agendamentos criados de manhã
-- ============================================================
SELECT cron.schedule(
  'send-reminders-midday',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yyscwmcghokyzhtcluif.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5c2N3bWNnaG9reXpodGNsdWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2ODI5NiwiZXhwIjoyMDg3NjQ0Mjk2fQ.FwA-pcwih72mOv36lawPFYWhRb7BiKCQksITjrNzwFg"}'::jsonb,
    body := '{"triggered_by":"pg_cron_midday"}'::jsonb
  );
  $$
);

-- ============================================================
-- Job 3: 19:00 UTC (20:00 WAT Angola)
-- Última oportunidade do dia para enviar lembretes
-- ============================================================
SELECT cron.schedule(
  'send-reminders-evening',
  '0 19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yyscwmcghokyzhtcluif.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5c2N3bWNnaG9reXpodGNsdWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA2ODI5NiwiZXhwIjoyMDg3NjQ0Mjk2fQ.FwA-pcwih72mOv36lawPFYWhRb7BiKCQksITjrNzwFg"}'::jsonb,
    body := '{"triggered_by":"pg_cron_evening"}'::jsonb
  );
  $$
);

-- ============================================================
-- 3. Verificar jobs registados
-- ============================================================
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'send-reminders%'
ORDER BY jobname;

SELECT '✅ pg_cron configurado: 3 execuções diárias (07:00, 12:00, 19:00 UTC)' AS resultado;
