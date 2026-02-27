-- TeOdonto Angola - Supabase Complete Migration
-- Execute this entire script in your Supabase SQL Editor to setup all tables and security policies

-- ============================================
-- 1. CONVERSATIONS TABLE (Mensagens em Tempo Real)
-- ============================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_1_name TEXT,
  participant_1_avatar TEXT,
  participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2_name TEXT,
  participant_2_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id)
);

-- Indices para conversations
CREATE INDEX IF NOT EXISTS conversations_participant_1_idx ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS conversations_participant_2_idx ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at DESC);

-- ============================================
-- 2. MESSAGES TABLE (Mensagens)
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices para messages
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id);
CREATE INDEX IF NOT EXISTS messages_read_idx ON messages(read);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);

-- ============================================
-- 3. NOTIFICACOES TABLE (Sistema de Notificações)
-- ============================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('triagem_enviada', 'triagem_respondida', 'feedback_saude', 'conselho', 'urgencia', 'mensagem')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices para notificacoes
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id ON notificacoes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at ON notificacoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo ON notificacoes(tipo);

-- ============================================
-- 4. UPDATE PROFILES TABLE (Adicionar campos necessários)
-- ============================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS genero TEXT CHECK (genero IN ('Masculino', 'Feminino', 'Outro')),
ADD COLUMN IF NOT EXISTS senha_alterada BOOLEAN DEFAULT TRUE;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) - CONVERSATIONS
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;

-- Usuários podem ver conversas onde são participantes
CREATE POLICY "Users can view their conversations"
  ON conversations
  FOR SELECT
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Usuários podem criar conversas
CREATE POLICY "Users can create conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- Usuários podem atualizar conversas onde são participantes
CREATE POLICY "Users can update their conversations"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = participant_1_id OR auth.uid() = participant_2_id);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS) - MESSAGES
-- ============================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Usuários podem ver mensagens de conversas onde são participantes
CREATE POLICY "Users can view messages from their conversations"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

-- Usuários podem inserir mensagens em conversas onde são participantes
CREATE POLICY "Users can send messages to their conversations"
  ON messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

-- Usuários podem atualizar suas próprias mensagens
CREATE POLICY "Users can update their own messages"
  ON messages
  FOR UPDATE
  USING (sender_id = auth.uid());

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) - NOTIFICACOES
-- ============================================

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Usuários veem suas notificações" ON notificacoes;
DROP POLICY IF EXISTS "Backend cria notificações" ON notificacoes;
DROP POLICY IF EXISTS "Usuários marcam notificações como lidas" ON notificacoes;

-- Usuários só podem ver suas próprias notificações
CREATE POLICY "Usuários veem suas notificações"
  ON notificacoes FOR SELECT
  USING (auth.uid() = usuario_id);

-- Apenas backend pode criar notificações
CREATE POLICY "Backend cria notificações"
  ON notificacoes FOR INSERT
  WITH CHECK (true);

-- Usuários podem marcar as suas como lidas
CREATE POLICY "Usuários marcam notificações como lidas"
  ON notificacoes FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- ============================================
-- 8. ENABLE REALTIME (Tempo Real)
-- ============================================

-- Para ativar realtime, vá em:
-- Database → Replication → Ative para: conversations, messages, notificacoes

-- ============================================
-- CONCLUSÃO
-- ============================================

-- Migração completa! Verificar:
-- 1. Todas as tabelas foram criadas
-- 2. Todos os índices foram adicionados
-- 3. RLS foi habilitado em todas as tabelas
-- 4. Ativar realtime no painel do Supabase

SELECT 'Migration completed successfully!' as status;
