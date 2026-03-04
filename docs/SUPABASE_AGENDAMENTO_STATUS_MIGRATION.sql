/**
 * Script SQL para adicionar constraint de status válido na tabela agendamentos
 * 
 * Este script:
 * 1. Adiciona a coluna status com valor padrão 'pendente' se não existir
 * 2. Remove constraint existente se houver
 * 3. Adiciona nova constraint CHECK para validar statuses
 * 4. Atualiza registros inválidos para 'pendente'
 * 
 * Instruções:
 * 1. Acesse seu projeto Supabase (https://app.supabase.com)
 * 2. Vá em "SQL Editor" > "+ New Query"
 * 3. Copie o conteúdo deste script
 * 4. Clique em "Run"
 */

-- ============================================
-- 1. GARANTIR QUE COLUNA STATUS EXISTA
-- ============================================
ALTER TABLE IF EXISTS public.agendamentos
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';

-- ============================================
-- 2. ATUALIZAR REGISTROS COM STATUS INVÁLIDO OU NULO
-- ============================================
-- Atualiza registros com status nulo ou vazio para 'pendente'
UPDATE public.agendamentos
SET status = 'pendente'
WHERE status IS NULL OR status = '' OR status NOT IN ('pendente', 'agendado', 'confirmado', 'cancelado', 'realizado');

-- ============================================
-- 3. REMOVER CONSTRAINT EXISTENTE SE HOUVER
-- ============================================
ALTER TABLE IF EXISTS public.agendamentos
DROP CONSTRAINT IF EXISTS chk_agendamento_status;

-- ============================================
-- 4. ADICIONAR NOVA CONSTRAINT CHECK
-- ============================================
-- Adiciona constraint para validar apenas statuses permitidos
ALTER TABLE IF EXISTS public.agendamentos
ADD CONSTRAINT chk_agendamento_status 
CHECK (status IN ('pendente', 'agendado', 'confirmado', 'cancelado', 'realizado'));

-- ============================================
-- 5. ATUALIZAR REGISTROS ANTIGOS COM 'concluido' PARA 'realizado'
-- ============================================
UPDATE public.agendamentos
SET status = 'realizado'
WHERE status = 'concluido';

-- ============================================
-- 6. CRIAR ÍNDICE PARA STATUS (otimização)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos(status);

-- ============================================
-- 7. CONFIRMAR MUDANÇAS
-- ============================================
SELECT 
    'Status válidos permitidos:' AS mensagem,
    ARRAY['pendente', 'agendado', 'confirmado', 'cancelado', 'realizado'] AS status_permitidos
UNION ALL
SELECT 
    'Total de agendamentos: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos
UNION ALL
SELECT 
    'Agrupados por status:',
    NULL
UNION ALL
SELECT 
    '  - pendente: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos WHERE status = 'pendente'
UNION ALL
SELECT 
    '  - agendado: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos WHERE status = 'agendado'
UNION ALL
SELECT 
    '  - confirmado: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos WHERE status = 'confirmado'
UNION ALL
SELECT 
    '  - realizado: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos WHERE status = 'realizado'
UNION ALL
SELECT 
    '  - cancelado: ' || COUNT(*)::text,
    NULL
FROM public.agendamentos WHERE status = 'cancelado';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
SELECT 'MIGRACAO CONCLUIDA COM SUCESSO - Status agendado agora é válido' AS status;

