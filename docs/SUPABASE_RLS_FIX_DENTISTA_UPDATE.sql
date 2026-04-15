-- =====================================================
-- FIX RLS: TRIAGENS SELECT & UPDATE PERMISSION
-- =====================================================
-- Allows dentists to see, claim and respond to cases even if not yet assigned.

-- 1. Permissão para VER casos não atribuídos (Necessário para abrir Detalhes)
DROP POLICY IF EXISTS "Triagens Select Public" ON public.triagens;
CREATE POLICY "Triagens Select Public"
ON public.triagens
FOR SELECT
TO authenticated
USING (
  (status = 'pendente' AND dentista_id IS NULL)
  OR auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
);

-- 2. Permissão para ATUALIZAR (Reset e Re-create para garantir)
DROP POLICY IF EXISTS "Triagens Update" ON public.triagens;
CREATE POLICY "Triagens Update"
ON public.triagens
FOR UPDATE
TO authenticated
USING (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR dentista_id IS NULL 
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR dentista_id IS NULL 
  OR public.is_admin()
);

-- 3. Garantia para inserir respostas
DROP POLICY IF EXISTS "Respostas Insert" ON public.respostas_triagem;
CREATE POLICY "Respostas Insert"
ON public.respostas_triagem
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = dentista_id OR public.is_admin());

SELECT 'Policies updated: Select, Update and Insert' as status;
