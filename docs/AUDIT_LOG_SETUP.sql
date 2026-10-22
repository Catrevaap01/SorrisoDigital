-- ============================================================
--  AUDIT LOG — TeOdonto Angola
--  Execute este script no Supabase SQL Editor (uma única vez)
--  Captura: INSERT / UPDATE / DELETE nas tabelas críticas
-- ============================================================

-- 1. Tabela principal de auditoria
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Quem fez a acção
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  user_tipo     text,          -- 'admin' | 'dentista' | 'secretario' | 'paciente'

  -- O quê e onde
  acao          text NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAIL' | 'RESET_PASSWORD' | 'ASSIGN_DENTISTA' | ...
  tabela        text,          -- nome da tabela afectada (null para acções de auth)
  registo_id    text,          -- PK do registo afectado

  -- Dados
  dados_antes   jsonb,         -- snapshot antes (UPDATE / DELETE)
  dados_depois  jsonb,         -- snapshot depois (INSERT / UPDATE)

  -- Contexto extra
  descricao     text,          -- mensagem legível opcional
  ip            text,          -- endereço IP (preenchido pelo cliente, se disponível)
  user_agent    text           -- browser / plataforma (opcional)
);

-- Índices para pesquisa eficiente
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_acao_idx       ON public.audit_log (acao);
CREATE INDEX IF NOT EXISTS audit_log_tabela_idx     ON public.audit_log (tabela);

-- RLS: apenas admins podem ler; o sistema pode inserir via service role
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins podem ler tudo
DROP POLICY IF EXISTS "admin_read_audit_log" ON public.audit_log;
CREATE POLICY "admin_read_audit_log"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tipo = 'admin'
    )
  );

-- Qualquer utilizador autenticado pode inserir (o service role ignora RLS)
DROP POLICY IF EXISTS "authenticated_insert_audit_log" ON public.audit_log;
CREATE POLICY "authenticated_insert_audit_log"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================
-- 2. Função genérica de trigger para captura automática
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_email     text;
  v_tipo      text;
  v_acao      text;
  v_antes     jsonb;
  v_depois    jsonb;
  v_reg_id    text;
BEGIN
  -- Tentar obter o utilizador actual do JWT
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF v_user_id IS NOT NULL THEN
    SELECT email, tipo INTO v_email, v_tipo
    FROM public.profiles
    WHERE id = v_user_id
    LIMIT 1;
  END IF;

  v_acao := TG_OP;  -- INSERT | UPDATE | DELETE

  IF TG_OP = 'INSERT' THEN
    v_depois := to_jsonb(NEW);
    v_reg_id := NEW.id::text;
    v_antes  := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_antes  := to_jsonb(OLD);
    v_depois := to_jsonb(NEW);
    v_reg_id := NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    v_antes  := to_jsonb(OLD);
    v_depois := NULL;
    v_reg_id := OLD.id::text;
  END IF;

  INSERT INTO public.audit_log
    (user_id, user_email, user_tipo, acao, tabela, registo_id, dados_antes, dados_depois)
  VALUES
    (v_user_id, v_email, v_tipo, v_acao, TG_TABLE_NAME, v_reg_id, v_antes, v_depois);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Aplicar trigger nas tabelas críticas
-- ============================================================

-- agendamentos
DROP TRIGGER IF EXISTS trg_audit_agendamentos ON public.agendamentos;
CREATE TRIGGER trg_audit_agendamentos
  AFTER INSERT OR UPDATE OR DELETE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- triagens
DROP TRIGGER IF EXISTS trg_audit_triagens ON public.triagens;
CREATE TRIGGER trg_audit_triagens
  AFTER INSERT OR UPDATE OR DELETE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- profiles
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- fichas_clinicas (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fichas_clinicas') THEN
    EXECUTE '
      DROP TRIGGER IF EXISTS trg_audit_fichas ON public.fichas_clinicas;
      CREATE TRIGGER trg_audit_fichas
        AFTER INSERT OR UPDATE OR DELETE ON public.fichas_clinicas
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
    ';
  END IF;
END $$;

-- planos_tratamento (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planos_tratamento') THEN
    EXECUTE '
      DROP TRIGGER IF EXISTS trg_audit_planos ON public.planos_tratamento;
      CREATE TRIGGER trg_audit_planos
        AFTER INSERT OR UPDATE OR DELETE ON public.planos_tratamento
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
    ';
  END IF;
END $$;

-- prescricoes (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescricoes') THEN
    EXECUTE '
      DROP TRIGGER IF EXISTS trg_audit_prescricoes ON public.prescricoes;
      CREATE TRIGGER trg_audit_prescricoes
        AFTER INSERT OR UPDATE OR DELETE ON public.prescricoes
        FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
    ';
  END IF;
END $$;

-- ============================================================
-- 4. Verificação final
-- ============================================================
SELECT
  trigger_name,
  event_object_table AS tabela,
  event_manipulation AS evento
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_audit_%'
ORDER BY event_object_table, event_manipulation;

-- Sucesso!
SELECT 'audit_log configurado com sucesso ✅' AS resultado;
