-- ====================================================================
-- SCRIPT DE CORREÇÃO TOTAL DE RLS - TEODONTO ANGOLA
-- ====================================================================
-- Descrição: Garante acesso correto para Dentistas, Secretárias e Admins.
-- Resolve o problema de relatórios vazios (0 Kz) no painel do dentista.

-- 1. AGENDAMENTOS (APPOINTMENTS)
-- Garante que o dentista veja quem ele deve atender e a secretaria veja tudo.
DROP POLICY IF EXISTS "appointments_staff_access" ON appointments;
CREATE POLICY "appointments_staff_access" ON appointments FOR ALL 
USING (
  public.is_admin() OR 
  public.is_secretario() OR 
  dentist_id = auth.uid() OR
  patient_id = auth.uid()
);

-- 2. TRIAGENS
-- Permite que o dentista veja triagens atribuídas a ele e a secretaria gerencie.
DROP POLICY IF EXISTS "triagens_staff_access" ON triagens;
CREATE POLICY "triagens_staff_access" ON triagens FOR ALL 
USING (
  public.is_admin() OR 
  public.is_secretario() OR 
  dentista_id = auth.uid() OR
  paciente_id = auth.uid()
);

-- 3. PLANOS DE TRATAMENTO
-- Acesso vital para o financeiro. Dentista precisa ver os planos que criou/atribuiu.
DROP POLICY IF EXISTS "planos_staff_access" ON planos_tratamento;
CREATE POLICY "planos_staff_access" ON planos_tratamento FOR ALL 
USING (
  public.is_admin() OR 
  public.is_secretario() OR 
  dentista_id = auth.uid() OR 
  paciente_id = auth.uid()
);

-- 4. PROCEDIMENTOS DE TRATAMENTO
-- Libera a visualização dos itens da tabela financeira para o Dentista.
DROP POLICY IF EXISTS "procedimentos_staff_access" ON procedimentos_tratamento;
CREATE POLICY "procedimentos_staff_access" ON procedimentos_tratamento FOR ALL 
USING (
  public.is_admin() OR 
  public.is_secretario() OR 
  EXISTS (
    SELECT 1 FROM planos_tratamento 
    WHERE id = plano_id AND (dentista_id = auth.uid() OR paciente_id = auth.uid() OR public.is_healthcare_pro())
  )
);

-- 5. PERMISSÕES DE LEITURA DE PERFIS (PROFILES)
-- Garante que o staff possa ver nomes de pacientes e outros dentistas.
DROP POLICY IF EXISTS "profiles_healthcare_read" ON profiles;
CREATE POLICY "profiles_healthcare_read" ON profiles FOR SELECT 
USING (public.is_healthcare_pro() OR auth.uid() = id);

-- 6. MENSAGENS E CONVERSAS
-- Garante que a secretaria e o dentista consigam trocar mensagens.
DROP POLICY IF EXISTS "conversations_participant_access" ON conversations;
CREATE POLICY "conversations_participant_access" ON conversations FOR ALL 
USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id OR public.is_admin());

DROP POLICY IF EXISTS "messages_participant_access" ON messages;
CREATE POLICY "messages_participant_access" ON messages FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM conversations 
    WHERE id = conversation_id AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  ) OR public.is_admin()
);

-- LOG DE CONCLUSÃO
SELECT 'POLÍTICAS DE SEGURANÇA ATUALIZADAS COM SUCESSO' as status;
