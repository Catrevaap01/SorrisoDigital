/**
 * Script SQL para criar a estrutura de admin no Supabase
 * 
 * Instruções:
 * 1. Acesse seu projeto Supabase (https://app.supabase.com)
 * 2. Vá em "SQL Editor" > "+ New Query"
 * 3. Copie o conteúdo deste script
 * 4. Clique em "Run"
 */

-- ============================================
-- 1. ADICIONAR COLUNA 'tipo' NA TABELA PROFILES
-- ============================================
-- Se a coluna ainda não existe, descomente:
-- ALTER TABLE profiles ADD COLUMN tipo TEXT DEFAULT 'paciente';

-- ============================================
-- 2. CRIAR FUNÇÃO PARA ATUALIZAR PERFIL APÓS AUTH
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tipo, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'tipo', 'paciente'),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar novo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. HABILITAR RLS (ROW LEVEL SECURITY)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para usuários lerem seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política para usuários atualizarem seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Política para admin ver todos os perfis
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo = 'admin'
    )
  );

-- Política para admin atualizar qualquer perfil
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo = 'admin'
    )
  );

-- Política para admin inserir perfis (necessária quando RLS está ativa)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" 
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo = 'admin'
    )
  );

-- ============================================
-- 4. CRIAR PRIMEIRO ADMIN (OPCIONAL)
-- ============================================
-- Via SQL direto (não é recomendado, role-based auth é melhor)
-- INSERT INTO public.profiles (id, email, nome, tipo, created_at)
-- VALUES (
--   'seu-user-id-aqui',
--   'admin@example.com',
--   'Admin Nome',
--   'admin',
--   now()
-- );

-- ============================================
-- 5. ADICIONAR COLUNA senha_alterada SE NÃO EXISTIR
-- ============================================
-- utilitários de extensão: adiciona as colunas necessárias caso ainda não
-- existam. rodar essas instruções sempre que for atualizar o schema ajuda a
-- evitar erros como "Could not find the 'crm' column".
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS senha_alterada BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS crm TEXT;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cro TEXT;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS especialidade TEXT;

-- ============================================
-- 6. TABELAS DE AGENDAMENTOS (e demais)
-- ============================================

-- criar agendamentos caso ainda não exista (utilizada por funcionalidades de
-- triagem/agenda). se essa tabela não estiver presente você verá erros como
-- "could not find table public.agendamentos".
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    dentista_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    data_agendamento timestamptz NOT NULL,
    tipo text,
    observacoes text,
    status text,
    prioridade text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- índices úteis
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente ON public.agendamentos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_dentista ON public.agendamentos(dentista_id);

-- habilitar RLS depois de criar a tabela (políticas podem ser aplicadas via
-- outros scripts, como SUPABASE_RLS_ADMIN_READ_REPORTS.sql)
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. TABELAS DE MENSAGENS
-- ============================================

-- criar conversas se ainda não existir
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_1_name text,
    participant_1_avatar text,
    participant_2_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_2_name text,
    participant_2_avatar text,
    last_message text,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- criar mensagens se ainda não existir
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name text,
    sender_avatar text,
    content text,
    read boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz
);

-- índices úteis
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON public.conversations(participant_1_id, participant_2_id);

-- habilitar RLS nas tabelas de conversa/mensagem
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- políticas para conversas
DROP POLICY IF EXISTS "Participants can view conversation" ON public.conversations;
CREATE POLICY "Participants can view conversation"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

DROP POLICY IF EXISTS "Participants can insert conversation" ON public.conversations;
CREATE POLICY "Participants can insert conversation"
  ON public.conversations
  FOR INSERT
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- políticas para mensagens
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
    )
  );

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
    )
  );

-- permitir que administradores leiam tudo (opcional)
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
CREATE POLICY "Admins can view all conversations"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tipo = 'admin'));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tipo = 'admin'));

-- ============================================
-- FIM DO SCRIPT
-- ============================================
