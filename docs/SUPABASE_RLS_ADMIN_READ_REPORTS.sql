-- ========================================
-- RLS: LEITURA DE RELATORIOS PARA ADMIN
-- ========================================
-- Execute no SQL Editor do Supabase.
-- Objetivo: permitir que usuario com tipo = 'admin' leia os dados
-- necessarios para relatorios, sem abrir leitura para todos.

-- 1) Funcao auxiliar (caso ainda nao exista)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.tipo, '')) = 'admin'
  );
$$;

-- 2) Garantir RLS ativo nas tabelas (se ja estiver, nao altera comportamento)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agendamentos ENABLE ROW LEVEL SECURITY;

-- 3) Policies de leitura para admin
-- PROFILES
DROP POLICY IF EXISTS "Admins can read all profiles for reports" ON public.profiles;
CREATE POLICY "Admins can read all profiles for reports"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- TRIAGENS
DROP POLICY IF EXISTS "Admins can read all triagens for reports" ON public.triagens;
CREATE POLICY "Admins can read all triagens for reports"
ON public.triagens
FOR SELECT
TO authenticated
USING (public.is_admin());

-- MESSAGES
DROP POLICY IF EXISTS "Admins can read all messages for reports" ON public.messages;
CREATE POLICY "Admins can read all messages for reports"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_admin());

-- AGENDAMENTOS
DROP POLICY IF EXISTS "Admins can read all agendamentos for reports" ON public.agendamentos;
CREATE POLICY "Admins can read all agendamentos for reports"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 4) Verificacao rapida
SELECT
  public.is_admin() AS usuario_logado_e_admin,
  (SELECT count(*) FROM public.profiles) AS total_profiles_visiveis,
  (SELECT count(*) FROM public.triagens) AS total_triagens_visiveis,
  (SELECT count(*) FROM public.messages) AS total_messages_visiveis,
  (SELECT count(*) FROM public.agendamentos) AS total_agendamentos_visiveis;
