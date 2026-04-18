-- Corrige ambientes antigos onde `procedimentos_tratamento`
-- ainda nao possui colunas usadas pelo app atual.

ALTER TABLE public.procedimentos_tratamento
  ADD COLUMN IF NOT EXISTS sessao_numero INTEGER;

ALTER TABLE public.procedimentos_tratamento
  ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'sem_factura';

ALTER TABLE public.procedimentos_tratamento
  ADD COLUMN IF NOT EXISTS numero_factura TEXT;

ALTER TABLE public.procedimentos_tratamento
  ADD COLUMN IF NOT EXISTS factura_emitida_em TIMESTAMPTZ;

ALTER TABLE public.procedimentos_tratamento
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;

UPDATE public.procedimentos_tratamento
SET status_financeiro = COALESCE(status_financeiro, 'sem_factura');

WITH base AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY plano_id
      ORDER BY created_at ASC, id ASC
    ) AS ordem_sessao
  FROM public.procedimentos_tratamento
)
UPDATE public.procedimentos_tratamento p
SET sessao_numero = COALESCE(p.sessao_numero, base.ordem_sessao)
FROM base
WHERE base.id = p.id;

ALTER TABLE public.procedimentos_tratamento
  ALTER COLUMN status_financeiro SET DEFAULT 'sem_factura';
