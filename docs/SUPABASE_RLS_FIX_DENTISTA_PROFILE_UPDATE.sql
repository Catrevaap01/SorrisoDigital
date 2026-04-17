-- =====================================================
-- TEODONTO ANGOLA - FIX RLS: DENTISTA PROFILE UPDATE
-- =====================================================
-- Permite que usuários do tipo 'dentista' atualizem perfis do tipo 'paciente'.
-- Isso resolve o erro ao salvar na tela "Gerir Pacientes".

-- 1. Remover política antiga se existir
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Dentistas can update patients" ON public.profiles;

-- 2. Recriar política para ADMIN (já existia, mas vamos unificar)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (
  public.is_admin_user(auth.uid())
);

-- 3. Criar política para DENTISTAS atualizarem PACIENTES
-- Um dentista pode atualizar qualquer perfil que seja do tipo 'paciente'
CREATE POLICY "Dentistas can update patients"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tipo = 'dentista'
  )
  AND tipo = 'paciente' -- Só pode atualizar pacientes
);

-- 4. Garantir que dentistas também possam VER todos os pacientes (caso não tivessem)
DROP POLICY IF EXISTS "Dentistas can view all patients" ON public.profiles;
CREATE POLICY "Dentistas can view all patients"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND tipo = 'dentista'
  )
  AND tipo = 'paciente'
);

SELECT 'Policies updated for Profile update priority' as status;
