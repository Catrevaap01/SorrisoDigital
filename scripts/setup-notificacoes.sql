-- ============================================================================
-- SETUP DE NOTIFICAÇÕES - TeOdonto Angola
-- ============================================================================
-- Este script cria as tabelas e políticas RLS para o sistema de notificações
-- Execute no Supabase SQL Editor

-- ============================================================================
-- 1. CRIAR TABELA notificacoes
-- ============================================================================

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Validação do tipo de notificação
ALTER TABLE notificacoes ADD CONSTRAINT check_notificacao_tipo
  CHECK (tipo IN ('triagem_enviada', 'triagem_respondida', 'feedback_saude', 'conselho', 'urgencia'));

-- ============================================================================
-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice para buscar notificações de um usuário
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_id 
  ON notificacoes(usuario_id);

-- Índice para buscar não lidas rapidamente
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_nao_lida 
  ON notificacoes(usuario_id, lida);

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_notificacoes_created_at 
  ON notificacoes(created_at DESC);

-- Índice para filtro por tipo
CREATE INDEX IF NOT EXISTS idx_notificacoes_tipo 
  ON notificacoes(tipo);

-- Índice combinado para busca comum
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_lida_data 
  ON notificacoes(usuario_id, lida, created_at DESC);

-- ============================================================================
-- 3. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. POLÍTICAS RLS
-- ============================================================================

-- Política: Usuários veem apenas suas próprias notificações (SELECT)
DROP POLICY IF EXISTS "Usuários veem suas notificações" ON notificacoes;
CREATE POLICY "Usuários veem suas notificações"
  ON notificacoes FOR SELECT
  USING (auth.uid() = usuario_id);

-- Política: Backend cria notificações (INSERT)
-- Se usar como tabela pública, remova `WITH CHECK (true)` para mais segurança
DROP POLICY IF EXISTS "Backend cria notificações" ON notificacoes;
CREATE POLICY "Backend cria notificações"
  ON notificacoes FOR INSERT
  WITH CHECK (true);

-- Política: Usuários marcam suas notificações como lidas (UPDATE)
DROP POLICY IF EXISTS "Usuários atualizam suas notificações" ON notificacoes;
CREATE POLICY "Usuários atualizam suas notificações"
  ON notificacoes FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- Política: Usuários deletam suas notificações (DELETE)
DROP POLICY IF EXISTS "Usuários deletam suas notificações" ON notificacoes;
CREATE POLICY "Usuários deletam suas notificações"
  ON notificacoes FOR DELETE
  USING (auth.uid() = usuario_id);

-- ============================================================================
-- 5. TRIGGER PARA ATUALIZAR atualizado_em
-- ============================================================================

-- Criar função que atualiza timestamp
CREATE OR REPLACE FUNCTION atualizar_timestamp_notificacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_notificacao ON notificacoes;
CREATE TRIGGER trigger_atualizar_timestamp_notificacao
  BEFORE UPDATE ON notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp_notificacao();

-- ============================================================================
-- 6. FUNÇÃO PARA CONTAR NOTIFICAÇÕES NÃO LIDAS
-- ============================================================================

CREATE OR REPLACE FUNCTION contar_notificacoes_nao_lidas(usuario_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notificacoes
    WHERE usuario_id = usuario_uuid AND lida = FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. VIEW PARA NOTIFICAÇÕES NÃO LIDAS
-- ============================================================================

CREATE OR REPLACE VIEW v_notificacoes_nao_lidas AS
SELECT 
  n.id,
  n.usuario_id,
  n.tipo,
  n.titulo,
  n.mensagem,
  n.dados,
  n.created_at,
  p.nome as usuario_nome
FROM notificacoes n
LEFT JOIN auth.users u ON n.usuario_id = u.id
LEFT JOIN profiles p ON n.usuario_id = p.id
WHERE n.lida = FALSE
ORDER BY n.created_at DESC;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Se usar um role específico para sua aplicação, ajuste abaixo
-- Exemplo: GRANT ALL ON notificacoes TO seu_app_role;

-- ============================================================================
-- 9. DADOS DE TESTE (Opcional)
-- ============================================================================

-- Descomente para inserir dados de teste:
/*
INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, dados, lida)
VALUES 
(
  '00000000-0000-0000-0000-000000000001'::UUID,
  'triagem_enviada',
  'Nova Triagem Recebida',
  'João Silva enviou uma triagem sobre dor intensa',
  '{"triagem_id": "uuid-aqui", "paciente_id": "uuid-aqui"}'::JSONB,
  FALSE
);
*/

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
-- Verificar se tudo foi criado corretamente:
-- SELECT * FROM notificacoes LIMIT 10;
-- SELECT COUNT(*) as total FROM notificacoes;
