# Supabase Setup Guide - TeOdonto Angola

## Tabelas Necessárias

Execute os seguintes comandos SQL no seu projeto Supabase para criar as tabelas necessárias para as novas funcionalidades.

### 1. Tabela de Conversas (conversations)

```sql
CREATE TABLE public.conversations (
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
  
  -- Índices para melhor performance
  CONSTRAINT different_participants CHECK (participant_1_id != participant_2_id)
);

CREATE INDEX conversations_participant_1_idx ON conversations(participant_1_id);
CREATE INDEX conversations_participant_2_idx ON conversations(participant_2_id);
CREATE INDEX conversations_updated_at_idx ON conversations(updated_at DESC);
```

### 2. Tabela de Mensagens (messages)

```sql
CREATE TABLE public.messages (
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

CREATE INDEX messages_conversation_idx ON messages(conversation_id);
CREATE INDEX messages_sender_idx ON messages(sender_id);
CREATE INDEX messages_read_idx ON messages(read);
CREATE INDEX messages_created_at_idx ON messages(created_at DESC);
```

### 3. Atualizar Tabela profiles (se necessário)

Se a coluna `foto_url` não existir, execute:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS foto_url TEXT;
```

---

## Row Level Security (RLS)

Adicione as seguintes políticas de RLS para segurança:

### Conversations RLS

```sql
-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

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
```

### Messages RLS

```sql
-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

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
```

---

## Configuração Realtime

Para ativar o Realtime em seu projeto Supabase:

1. Vá para **Database** → **Replication**
2. Ative replication para as tabelas:
   - `conversations`
   - `messages`

Isso permitirá que o cliente receba atualizações em tempo real via WebSockets.

---

## Variáveis de Ambiente

Certifique-se de que seu arquivo `.env.local` contém:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Testes

### Teste de Tabelas

Para verificar se as tabelas foram criadas corretamente:

```sql
-- Verificar tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('conversations', 'messages');

-- Verificar colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'conversations';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'messages';
```

### Teste de Realtime

Na sua aplicação, tente:
1. Abra dois chats simultâneos (pode ser em dois navegadores/dispositivos)
2. Envie uma mensagem de um lado
3. Você deve ver a mensagem aparecer no outro lado em menos de 1 segundo

Se isso não funcionar, verifique se o Realtime está ativado para as tabelas.

---

## Troubleshooting

### Mensagens não aparecem em tempo real
- Verifique se Realtime está ativado nas tabelas
- Verifique a conexão WebSocket (DevTools → Network)
- Verifique se o RLS permite leitura

### Erro ao criar mensagens
- Verifique se `sender_id` corresponde ao `auth.uid()` do usuário
- Verifique se a conversa existe e o usuário é participante
- Verifique RLS policies

### Conversas não aparecem
- Verifique se o usuário é um dos participantes
- Verifique RLS policies
- Verifique se `participant_1_id` e `participant_2_id` estão preenchidos

---

## Dicas de Performance

1. **Índices:** As índices foram criadas nas colunas mais consultadas
2. **Paginação:** Use `limit` e `offset` ao carregar histórico de mensagens
3. **Eager Loading:** Carregue dados relacionados em uma query quando possível
4. **Caching:** O contexto Auth cache o perfil do usuário

---

## Próximas Melhorias

1. **Busca Full-text:** Implementar busca em mensagens
2. **Presença:** Indicador de "digitando" ou "online"
3. **Reações:** Adicionar reações às mensagens
4. **Arquivos:** Envio de fotos/arquivos
5. **Criptografia:** Criptografar mensagens end-to-end

---

## Referências

- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
