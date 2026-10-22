-- ============================================================
--  REMINDER_LOG_SETUP.sql — TeOdonto Angola
--  Tabela de log de lembretes enviados.
--  Evita envios duplicados no worker de lembretes automáticos.
--
--  Executar UMA VEZ no Supabase SQL Editor.
--  Script idempotente — pode re-executar sem erros.
-- ============================================================


-- ═══════════════════════════════════════════════
-- 1. TABELA PRINCIPAL
-- ═══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.reminder_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  canal          TEXT NOT NULL CHECK (canal IN ('in_app', 'email', 'whatsapp', 'push')),
  sucesso        BOOLEAN NOT NULL DEFAULT false,
  detalhes       TEXT,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════
-- 2. ÍNDICES DE PERFORMANCE
-- ═══════════════════════════════════════════════

-- Deduplicação: busca rápida por agendamento + canal + data
CREATE INDEX IF NOT EXISTS reminder_log_dedup_idx
  ON public.reminder_log (appointment_id, canal, sent_at DESC);

-- Listagem cronológica
CREATE INDEX IF NOT EXISTS reminder_log_sent_at_idx
  ON public.reminder_log (sent_at DESC);

-- Filtro por canal
CREATE INDEX IF NOT EXISTS reminder_log_canal_idx
  ON public.reminder_log (canal);


-- ═══════════════════════════════════════════════
-- 3. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════

ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Service role pode tudo (Edge Functions + pg_cron)
DROP POLICY IF EXISTS "service_full_access_reminder_log" ON public.reminder_log;
CREATE POLICY "service_full_access_reminder_log"
  ON public.reminder_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Utilizadores autenticados podem inserir (worker client-side)
DROP POLICY IF EXISTS "authenticated_insert_reminder_log" ON public.reminder_log;
CREATE POLICY "authenticated_insert_reminder_log"
  ON public.reminder_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Admins, dentistas e secretários podem ler (auditoria)
DROP POLICY IF EXISTS "staff_read_reminder_log" ON public.reminder_log;
CREATE POLICY "staff_read_reminder_log"
  ON public.reminder_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND tipo IN ('admin', 'dentista', 'secretario')
    )
  );


-- ═══════════════════════════════════════════════
-- 4. DOCUMENTAÇÃO
-- ═══════════════════════════════════════════════

COMMENT ON TABLE public.reminder_log IS
  'Log de lembretes de consulta enviados pelo reminderWorkerService e Edge Function send-reminders. Evita duplicatas.';

COMMENT ON COLUMN public.reminder_log.appointment_id IS
  'FK para appointments.id — agendamento lembrado';

COMMENT ON COLUMN public.reminder_log.canal IS
  'Canal de envio: in_app | email | whatsapp | push';

COMMENT ON COLUMN public.reminder_log.sucesso IS
  'Se o lembrete foi enviado com sucesso naquele canal';

COMMENT ON COLUMN public.reminder_log.detalhes IS
  'Mensagem de erro em caso de falha, NULL se sucesso';

COMMENT ON COLUMN public.reminder_log.sent_at IS
  'Timestamp do envio — usado para deduplicação diária';


-- ═══════════════════════════════════════════════
-- 5. LIMPEZA AUTOMÁTICA (opcional — requer pg_cron)
-- ═══════════════════════════════════════════════
-- Remove logs com mais de 90 dias, diariamente às 03:00 UTC.
-- Descomente para activar:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--   'limpar-reminder-log',
--   '0 3 * * *',
--   $$DELETE FROM public.reminder_log WHERE sent_at < now() - interval '90 days'$$
-- );


-- ═══════════════════════════════════════════════
-- 6. VERIFICAÇÃO
-- ═══════════════════════════════════════════════

SELECT
  '✅ reminder_log criada e configurada com sucesso' AS status,
  (SELECT count(*) FROM public.reminder_log) AS total_registos,
  (SELECT count(*) FROM information_schema.table_constraints
   WHERE table_name = 'reminder_log' AND constraint_type = 'CHECK') AS check_constraints,
  (SELECT count(*) FROM pg_policies
   WHERE tablename = 'reminder_log') AS policies_activas;
