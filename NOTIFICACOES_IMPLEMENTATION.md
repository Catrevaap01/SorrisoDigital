# Sistema de Notificações - Implementação Completa

## Visão Geral

Sistema automático de notificações bidirecionais entre pacientes e dentistas com feedback inteligente baseado na severidade dos sintomas.

## Arquitetura

```
┌─────────────────────┐
│  Paciente envia     │
│  Triagem            │
└──────────┬──────────┘
           │
           ├──► notificacoesService.notificarTriagemEnviada()
           │    └─► Notifica TODOS os dentistas
           │
           ├──► notificacoesService.gerarFeedbackAutomatico()
           │    └─► Análise de severidade
           │
           └──► notificacoesService.enviarFeedbackPaciente()
                └─► Feedback ao paciente (urgência/alerta/conselho)

┌─────────────────────┐
│  Dentista Responde  │
│  Triagem            │
└──────────┬──────────┘
           │
           └──► notificacoesService.notificarTriagemRespondida()
                └─► Notifica PACIENTE que resposta foi recebida
```

## Arquivos Criados

### 1. **Serviço de Notificações**
- **Arquivo**: `src/services/notificacoesService.ts` (293 linhas)
- **Funções**:
  - `notificarTriagemEnviada()` - Notifica dentistas de triagem
  - `notificarTriagemRespondida()` - Notifica paciente de resposta
  - `gerarFeedbackAutomatico()` - Gera feedback inteligente
  - `enviarFeedbackPaciente()` - Envia feedback automático
  - `buscarNotificacoesNaoLidas()` - Recupera não lidas
  - `buscarTodasNotificacoes()` - Recupera todas
  - `marcarNotificacaoComoLida()` - Marca como lida
  - `limparNotificacoesAntigas()` - Limpeza automática

### 2. **Tela de Notificações**
- **Arquivo**: `src/screens/shared/NotificacoesScreen.tsx` (252 linhas)
- **Funcionalidades**:
  - Lista todas as notificações do usuário
  - Ordenação por recentes primeiro
  - Indicadores visuais por tipo
  - Cards destacados para não lidas
  - Mostra recomendações quando disponíveis
  - Pull-to-refresh
  - Marca como lida ao tocar

### 3. **Integração com Triagem**
- **Arquivo**: `src/services/triagemService.ts` (atualizado)
- **Mudanças**:
  - `criarTriagem()` agora dispara notificações automáticas
  - `responderTriagem()` agora notifica o paciente

### 4. **Navegação**
- **Arquivo**: `src/navigation/AppNavigator.tsx` (atualizado)
- **Mudanças**:
  - Adicionada aba "Notificações" aos Pacientes
  - Adicionada aba "Notificações" aos Dentistas
  - Importado `NotificacoesScreen`

## Tipos de Notificações

| Tipo | Destinatário | Quando | Ícone | Cor |
|------|---|---|---|---|
| `triagem_enviada` | Dentista | Paciente envia triagem | medical | #0066CC |
| `triagem_respondida` | Paciente | Dentista responde | checkmark-circle | #00AA00 |
| `urgencia` | Paciente | Dor ≥8 ou duração longa | alert-circle | #DD3333 |
| `feedback_saude` | Paciente | Feedback automático | info-circle | #0088FF |
| `conselho` | Paciente | Dica de cuidado | bulb | #FFA726 |

## Fluxo Completo - Exemplo

### Cenário: Paciente com dor de dente intensa

```
1. Paciente abre TriagemScreen
   └─ Preenche: Sintoma = "Dor intensa", Dor = 9, Duração = "Mais de 1 semana"
   └─ Clica em "Enviar"

2. criarTriagem() executa:
   ├─ Upload das imagens
   ├─ Insere triagem no banco
   ├─ Busca nome do paciente
   │
   ├─► notificarTriagemEnviada()
   │   └─ Cria notificação para CADA dentista:
   │      "Nova Triagem Recebida"
   │      "João Silva enviou uma triagem sobre dor intensa"
   │
   ├─► gerarFeedbackAutomatico()
   │   └─ Analisa: dor >= 8 → tipo = "urgencia"
   │   └─ Retorna:
   │      titulo: "Atenção: Procure atendimento urgente"
   │      recomendacoes: [
   │        "Procure um dentista em até 24 horas",
   │        "Evite alimentos duros e quentes",
   │        "Tome anti-inflamatório se houver dor intensa"
   │      ]
   │
   └─► enviarFeedbackPaciente()
       └─ Cria notificação para PACIENTE:
          Tipo: "urgencia"
          Título: "Atenção: Procure atendimento urgente"
          Com recomendações visíveis no card

3. Paciente recebe DUAS notificações:
   ✓ Feedback automático (urgência)
   ✓ Aba "Notificações" fica com badge

4. Dentistas recebem notificação:
   ✓ "Nova Triagem Recebida"
   ✓ Podem clicar para abrir e responder no Dashboard

5. Dentista abre CasoDetalhe e responde:
   └─ responderTriagem() executa:
      └─► notificarTriagemRespondida()
          └─ Cria notificação para paciente:
             "Triagem Respondida"
             "Dr. Silva respondeu à sua triagem com orientações"

6. Paciente vê nova notificação na aba "Notificações"
```

## Diagrama de Banco de Dados

```
notificacoes (tabela principal)
├─ id: UUID
├─ usuario_id: UUID → profiles(id)
├─ tipo: TEXT (enum)
├─ titulo: TEXT
├─ mensagem: TEXT
├─ dados: JSONB (recomendações, IDs, etc)
├─ lida: BOOLEAN
├─ created_at: TIMESTAMP
└─ atualizado_em: TIMESTAMP

Índices:
├─ idx_notificacoes_usuario_id (busca por usuário)
├─ idx_notificacoes_lida (busca não lidas)
├─ idx_notificacoes_created_at (ordenação)
└─ idx_notificacoes_tipo (filtro por tipo)
```

## Recursos de UI

### NotificacoesScreen

```
┌─────────────────────────────────────┐
│ Notificações                        │
├─────────────────────────────────────┤
│  🔴 [NEW] Nova Triagem Recebida    │
│  João Silva enviou uma triagem...  │
│  Faz 2 minutos                     │
│                                     │
│  ⭕ Triagem Respondida             │
│  Dr. Silva respondeu à sua triagem │
│  Faz 5 minutos                     │
│                                     │
│  🚨 Atenção: Procure Atendimento   │
│  Atenção: Procure atendimento...   │
│  ✓ Procure um dentista em 24h      │
│  ✓ Evite alimentos duros           │
│  ✓ Tome anti-inflamatório          │
│  Faz 10 minutos                    │
└─────────────────────────────────────┘
```

## Feedback Automático - Matriz de Decisão

```
Intensidade Dor: 0-4
├─ Duração: < 2 dias → CONSELHO (💡)
└─ Duração: ≥ 2 dias → ALERTA (🔔)

Intensidade Dor: 5-7
└─ Sempre: ALERTA (🔔)

Intensidade Dor: ≥ 8
├─ Duração: Qualquer → URGÊNCIA (🚨)
└─ Duração: ≥ 1 semana → URGÊNCIA (🚨)
```

## Recomendações por Sintoma

```
"sangramento"
├─ Use escova macia para não irritar mais a gengiva
├─ Evite alimentos muito quentes ou picantes
└─ Enxágue com água morna e sal

"cárie"
├─ Reduza açúcar na dieta
├─ Use enxaguante bucal sem álcool
└─ Agende limpeza profissional

"bruxismo"
├─ Procure dormir melhor
├─ Tente relaxar antes de dormir
└─ Considere usar protetor noturno
```

## Testes Recomendados

### 1. Criar Triagem
```
✓ Paciente envia triagem
✓ Dentistas recebem notificação
✓ Paciente recebe feedback automático
✓ Feedback contém recomendações corretas
```

### 2. Responder Triagem
```
✓ Dentista abre CasoDetalhe
✓ Escreve resposta e clica enviar
✓ Paciente recebe notificação
✓ Notificação leva ao chat/triagem
```

### 3. NotificacoesScreen
```
✓ Carrega todas as notificações
✓ Ordena por recentes primeiro
✓ Destaca não lidas
✓ Toque marca como lida
✓ Pull-to-refresh funciona
✓ Icons e cores são apropriados
```

### 4. Tipagem Correta
```
✓ TypeScript sem erros
✓ Tipos de notificação validados
✓ Dados JSONB bem formados
```

## Integração com Existente

- ✅ Não quebra nada existente
- ✅ Adiciona apenas novos serviços
- ✅ Integra no fluxo de triagem sem alterações maiores
- ✅ Adiciona aba nova sem mudar outras
- ✅ Usa serviços de erro/logger existentes

## Performance

- Índices otimizados para busca de notificações não lidas
- Limpeza automática de notificações antigas (30+ dias)
- Realtime com Supabase (opcional, já suportado)
- Sem N+1 queries (busca eficiente)

## Segurança

- RLS garante que usuários só veem suas notificações
- Backend controla criação de notificações
- Sem exposição de dados sensíveis nos dados JSONB
- Validação de tipos com enum no banco

## Próximos Passos Opcionais

1. **Push Notifications**: Integrar com Expo Notifications
2. **Realtime**: Usar Supabase realtime para notificações em tempo real
3. **Email**: Enviar email resumido diariamente
4. **Badge Counter**: Mostrar número de não lidas na aba
5. **Sons**: Toque quando recebe notificação urgência
6. **Arquivo**: Mover notificações antigas para arquivo
