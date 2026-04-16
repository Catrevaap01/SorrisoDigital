-- ========================================
-- RPC: ESTATISTICAS DE RELATORIO (ADMIN)
-- ========================================
-- Execute no SQL Editor do Supabase.
-- Esta funcao retorna os totais reais do banco para o dashboard de relatorios.

CREATE OR REPLACE FUNCTION public.admin_report_stats()
RETURNS TABLE (
  total_cadastros BIGINT,
  total_dentistas BIGINT,
  total_pacientes BIGINT,
  total_consultas BIGINT,
  total_mensagens BIGINT,
  cadastros_mes_atual BIGINT,
  dentistas_mes_atual BIGINT,
  pacientes_mes_atual BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_consultas BIGINT := 0;
  v_total_mensagens BIGINT := 0;
BEGIN
  -- Evita erro 42P01 quando a tabela nao existe.
  IF to_regclass('public.agendamentos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*)::bigint FROM public.agendamentos'
      INTO v_total_consultas;
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'SELECT count(*)::bigint FROM public.messages'
      INTO v_total_mensagens;
  END IF;

  RETURN QUERY
  WITH inicio AS (
    SELECT date_trunc('month', now()) AS inicio_mes
  ),
  perfis_base AS (
    SELECT
      p.id,
      lower(coalesce(p.tipo, '')) AS tipo,
      p.created_at
    FROM public.profiles p
  )
  SELECT
    (
      SELECT count(*)::bigint
      FROM perfis_base
      WHERE tipo IN ('paciente', 'dentista', 'medico')
    ) AS total_cadastros,
    (
      SELECT count(*)::bigint
      FROM perfis_base
      WHERE tipo IN ('dentista', 'medico')
    ) AS total_dentistas,
    (
      SELECT count(*)::bigint
      FROM perfis_base
      WHERE tipo = 'paciente'
    ) AS total_pacientes,
    v_total_consultas AS total_consultas,
    v_total_mensagens AS total_mensagens,
    (
      SELECT count(*)::bigint
      FROM perfis_base, inicio
      WHERE tipo IN ('paciente', 'dentista', 'medico')
        AND created_at >= inicio.inicio_mes
    ) AS cadastros_mes_atual,
    (
      SELECT count(*)::bigint
      FROM perfis_base, inicio
      WHERE tipo IN ('dentista', 'medico')
        AND created_at >= inicio.inicio_mes
    ) AS dentistas_mes_atual,
    (
      SELECT count(*)::bigint
      FROM perfis_base, inicio
      WHERE tipo = 'paciente'
        AND created_at >= inicio.inicio_mes
    ) AS pacientes_mes_atual;
END;
$$;

-- Permite chamada por usuarios autenticados.
GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated;
