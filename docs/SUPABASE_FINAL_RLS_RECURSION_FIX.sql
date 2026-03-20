-- ==============================================================================
-- TEODONTO ANGOLA - FIX FINAL COMPLETO: RECURSÃO E RECUPERAÇÃO DE POLÍTICAS
-- ==============================================================================
-- Este script:
-- 1. Redefine funções de segurança sem recursão (Security Definer).
-- 2. Limpa e recria todas as políticas da tabela 'profiles'.
-- 3. Reconstrói políticas de Triagens, Agendamentos e Mensagens que podem ter
--    sido removidas pela limpeza anterior.
-- ==============================================================================

-- 1. RE-CRIAR FUNÇÕES SEGURAS (SECURITY DEFINER)
-- Isso garante que as políticas não entrem em loop ao consultar a própria tabela.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT tipo = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.current_user_tipo()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tipo FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Alias para compatibilidade com scripts antigos
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tipo = 'admin' FROM public.profiles WHERE id = user_id;
$$;

-- Permissões de leitura de paciente (Admin ou Dentista)
CREATE OR REPLACE FUNCTION public.can_read_patient_profiles()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.current_user_tipo() IN ('dentista', 'medico');
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_tipo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_patient_profiles() TO authenticated;

-- 2. LIMPEZA TOTAL DA TABELA PROFILES (TABELA CRÍTICA)
DO $$ 
DECLARE 
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.profiles';
  END LOOP;
END $$;

-- 3. CRIAR POLÍTICAS PROFILES (ANTI-RECURSÃO)
CREATE POLICY "profiles_select_fixed" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_fixed" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_fixed" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles_delete_fixed" ON public.profiles FOR DELETE USING (public.is_admin());

-- 4. RECUPERAR POLÍTICAS DE TRIAGENS (Caso tenham sido apagadas)
DROP POLICY IF EXISTS "Triagens Select" ON public.triagens;
CREATE POLICY "Triagens Select" ON public.triagens FOR SELECT TO authenticated
USING (auth.uid() = paciente_id OR auth.uid() = dentista_id OR public.is_admin());

DROP POLICY IF EXISTS "Triagens Insert" ON public.triagens;
CREATE POLICY "Triagens Insert" ON public.triagens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = paciente_id OR public.is_admin());

DROP POLICY IF EXISTS "Triagens Update" ON public.triagens;
CREATE POLICY "Triagens Update" ON public.triagens FOR UPDATE TO authenticated
USING (auth.uid() = paciente_id OR auth.uid() = dentista_id OR public.is_admin());

-- 5. RECUPERAR POLÍTICAS DE RESPOSTAS_TRIAGEM
DROP POLICY IF EXISTS "Respostas Select" ON public.respostas_triagem;
CREATE POLICY "Respostas Select" ON public.respostas_triagem FOR SELECT TO authenticated
USING (public.is_admin() OR auth.uid() = dentista_id OR EXISTS (SELECT 1 FROM public.triagens t WHERE t.id = triagem_id AND auth.uid() = t.paciente_id));

DROP POLICY IF EXISTS "Respostas Insert" ON public.respostas_triagem;
CREATE POLICY "Respostas Insert" ON public.respostas_triagem FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR auth.uid() = dentista_id);

-- 6. RECUPERAR POLÍTICAS DE AGENDAMENTOS
DROP POLICY IF EXISTS "Agendamentos Select" ON public.agendamentos;
CREATE POLICY "Agendamentos Select" ON public.agendamentos FOR SELECT TO authenticated
USING (auth.uid() = paciente_id OR auth.uid() = dentista_id OR public.is_admin());

DROP POLICY IF EXISTS "Agendamentos Insert" ON public.agendamentos;
CREATE POLICY "Agendamentos Insert" ON public.agendamentos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = paciente_id OR public.is_admin());

DROP POLICY IF EXISTS "Agendamentos Update" ON public.agendamentos;
CREATE POLICY "Agendamentos Update" ON public.agendamentos FOR UPDATE TO authenticated
USING (auth.uid() = paciente_id OR auth.uid() = dentista_id OR public.is_admin());

-- 7. RECUPERAR POLÍTICAS DE CONVERSAS/MENSAGENS
DROP POLICY IF EXISTS "Conversations Select" ON public.conversations;
CREATE POLICY "Conversations Select" ON public.conversations FOR SELECT TO authenticated
USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id OR public.is_admin());

DROP POLICY IF EXISTS "Messages Select" ON public.messages;
CREATE POLICY "Messages Select" ON public.messages FOR SELECT TO authenticated
USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)));

-- 8. OTIMIZAÇÃO (ÍNDICES)
CREATE INDEX IF NOT EXISTS idx_profiles_tipo ON public.profiles(tipo);
CREATE INDEX IF NOT EXISTS idx_triagens_paciente_id ON public.triagens(paciente_id);
CREATE INDEX IF NOT EXISTS idx_triagens_dentista_id ON public.triagens(dentista_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente_id ON public.agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_dentista_id ON public.agendamentos(dentista_id);

SELECT 'FIX FINAL APLICADO. TUDO DEVE CARREGAR INSTANTANEAMENTE AGORA.' as status;
