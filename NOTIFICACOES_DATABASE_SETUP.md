# Sistema de Notificações - Configuração do Banco de Dados

## Descrição

Sistema automático de notificações que:
1. Notifica dentistas quando paciente envia triagem
2. Envia feedback automático para o paciente baseado na severidade
3. Notifica paciente quando dentista responde à triagem
4. Gerencia notificações em tempo real

## Tabelas Necessárias

### 1. Tabela: `notificacoes`

```sql
CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('triagem_enviada', 'triagem_respondida', 'feedback_saude', 'conselho', 'urgencia')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  dados JSONB DEFAULT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_notificacoes_usuario_id ON notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_lida ON notificacoes(usuario_id, lida);
CREATE INDEX idx_notificacoes_created_at ON notificacoes(created_at DESC);
CREATE INDEX idx_notificacoes_tipo ON notificacoes(tipo);
```

## Tipos de Notificações

### 1. `triagem_enviada`
- **Destinatário**: Dentistas
- **Quando**: Quando um paciente envia uma triagem
- **Dados**:
  ```json
  {
    "triagem_id": "uuid",
    "paciente_id": "uuid"
  }
  ```

### 2. `triagem_respondida`
- **Destinatário**: Paciente
- **Quando**: Quando dentista responde à triagem do paciente
- **Dados**:
  ```json
  {
    "triagem_id": "uuid",
    "dentista_id": "nome do dentista"
  }
  ```

### 3. `feedback_saude` / `urgencia`
- **Destinatário**: Paciente
- **Quando**: Imediatamente após enviar triagem (automático)
- **Dados**:
  ```json
  {
    "triagem_id": "uuid",
    "recomendacoes": [
      "Procure um dentista em até 24 horas",
      "Evite alimentos duros e quentes",
      "Tome anti-inflamatório se houver dor intensa"
    ]
  }
  ```

## Fluxo de Notificações

### Quando Paciente Envia Triagem:

```
1. criarTriagem() é chamado
2. Triagem é inserida no banco
3. notificarTriagemEnviada() é chamado
   ├─ Busca todos os dentistas
   └─ Cria notificação "triagem_enviada" para cada dentista
4. gerarFeedbackAutomatico() é chamado
   └─ Retorna feedback baseado na severidade (urgencia/alerta/conselho)
5. enviarFeedbackPaciente() é chamado
   └─ Cria notificação "feedback_saude" ou "urgencia" para o paciente
```

### Quando Dentista Responde:

```
1. responderTriagem() é chamado
2. Resposta é inserida em "respostas_triagem"
3. Status da triagem é atualizado para "respondido"
4. notificarTriagemRespondida() é chamado
   └─ Cria notificação "triagem_respondida" para o paciente
```

## RLS (Row Level Security)

```sql
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

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
```

## Feedback Automático - Lógica

### Baseado em Intensidade de Dor:

- **≥ 8 ou duração ≥ 1 semana**: URGÊNCIA ⚠️
  - Título: "Atenção: Procure atendimento urgente"
  - Recomendações imediatas

- **5-7**: ALERTA 🔔
  - Título: "Avaliação recomendada"
  - Agende consulta nos próximos dias

- **< 5**: CONSELHO 💡
  - Título: "Dica de cuidado bucal"
  - Dicas gerais de higiene

### Recomendações Específicas por Sintoma:

```
"sangramento" → Use escova macia, evite alimentos quentes
"cárie" → Reduza açúcar, use enxaguante bucal
"bruxismo" → Durma melhor, relaxe antes de dormir
```

## Métodos do Serviço

### Notificações

```typescript
// Notificar dentistas de nova triagem
notificarTriagemEnviada(
  pacienteId: string,
  pacienteNome: string,
  triagemId: string,
  sintomaPrincipal: string
): Promise<ServiceResult>

// Notificar paciente de resposta
notificarTriagemRespondida(
  pacienteId: string,
  dentistaNome: string,
  triagemId: string,
  orientacao: string
): Promise<ServiceResult>

// Gerar feedback automático
gerarFeedbackAutomatico(
  sintomaPrincipal: string,
  intensidadeDor: number,
  duracao: string
): NotificacaoFeedback

// Enviar feedback ao paciente
enviarFeedbackPaciente(
  pacienteId: string,
  feedback: NotificacaoFeedback,
  triagemId: string
): Promise<ServiceResult>
```

### Leitura

```typescript
// Buscar não lidas
buscarNotificacoesNaoLidas(usuarioId: string)

// Buscar todas
buscarTodasNotificacoes(usuarioId: string)

// Marcar como lida
marcarNotificacaoComoLida(notificacaoId: string)
```

## UI - NotificacoesScreen

- Lista de todas as notificações do usuário
- Ordenadas por recentes primeiro
- Cards indicam tipo com ícone e cor diferente
- Cards não lidas têm destaque visual (barra lateral + fundo)
- Mostra recomendações quando disponíveis
- Toque para marcar como lida
- Pull-to-refresh para carregar novas

## Limpeza Automática

```typescript
// Remove notificações lidas mais antigas de 30 dias
limparNotificacoesAntigas(diasAntes: number = 30)
```

## Próximos Passos

1. Executar SQL de criação de tabelas
2. Testar fluxo completo:
   - Paciente envia triagem
   - Dentista recebe notificação
   - Paciente recebe feedback automático
   - Dentista responde
   - Paciente recebe notificação de resposta
3. Verificar NotificacoesScreen mostrando todas as notificações
