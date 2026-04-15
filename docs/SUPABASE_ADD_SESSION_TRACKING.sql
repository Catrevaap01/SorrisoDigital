-- =====================================================
-- TEODONTO ANGOLA - ADD SESSION TRACKING
-- =====================================================
-- Adiciona suporte para Login de Dispositivo Único

-- 1. Adicionar coluna last_session_id se não existir
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_session_id TEXT;

-- 2. Garantir permissões de RLS para que o usuário possa atualizar seu próprio session_id
-- (As políticas do script FINAL_RLS_RECURSION_FIX já cobrem o update pelo próprio ID)

-- 3. Índice para busca rápida (opcional mas recomendado)
CREATE INDEX IF NOT EXISTS idx_profiles_session_id ON public.profiles(last_session_id);

SELECT 'Coluna last_session_id adicionada com sucesso.' as status;
