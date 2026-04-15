-- ========================================
-- FIX RLS: ADMIN VISUALIZA TODOS OS DADOS
-- ========================================
-- Execute este script no SQL Editor do Supabase.
-- Objetivo: permitir que admin veja todos os perfis e os dados do relatorio.

-- 1) Funcao auxiliar segura para checar se o usuario logado eh admin
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

-- 2) Profiles: manter usuario vendo o proprio perfil + admin vendo todos
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users and admins can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- Update: usuario atualiza o proprio perfil; admin pode atualizar qualquer perfil
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users and admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- Delete: usuario apaga o proprio perfil; admin pode apagar qualquer perfil
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users and admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- 3) Tabelas usadas no relatorio geral (somente leitura para admin)
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_admin());

ALTER TABLE IF EXISTS public.agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all agendamentos" ON public.agendamentos;
CREATE POLICY "Admins can view all agendamentos"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 4) Confirmacao rapida
SELECT
  public.is_admin() AS logged_user_is_admin,
  (SELECT count(*) FROM public.profiles) AS total_profiles;
