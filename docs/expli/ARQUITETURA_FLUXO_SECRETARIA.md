# 🏥 Arquitetura do Fluxo de Triagem e Agendamento
## Sistema Centralizado na Secretaria

---

## 📋 Visão Geral

O sistema foi reestruturado para centralizar toda a lógica de triagem e agendamento na **Secretaria**. Pacientes e Dentistas agora dependem da secretária para que seus pedidos (triagens e agendamentos) sejam processados.

### Fluxo Geral

```
PACIENTE envia TRIAGEM
   ↓
TRIAGEM Status: "triagem_pendente_secretaria"
   ↓
SECRETÁRIA revisa e atribui a DENTISTA
   ↓
TRIAGEM Status: "pendente" (aguardando dentista responder)
   ↓
DENTISTA responde a triagem
```

---

## 1️⃣ FLUXO DE TRIAGEM

### Ciclo de Vida de uma Triagem

| Status | Ator | Ação | Próximo Status |
|--------|------|------|---|
| `triagem_pendente_secretaria` | Sistema (padrão) | Triagem criada por paciente | — |
| `triagem_pendente_secretaria` | Secretária | ✅ Aprova e atribui a dentista | `pendente` |
| `triagem_pendente_secretaria` | Secretária | ❌ Rejeita (dados inválidos) | `recusada` |
| `pendente` | Dentista | Aguarda análise | `em_triagem` ou `respondida` |
| `em_triagem` | Dentista | Respondendo | — |
| `respondida` | Dentista | Completou a triagem | `respondida` |
| `recusada` | Secretária | Triagem rejeitada | (encerrada) |
| `cancelada` | Paciente/Sistema | Cancelada | (encerrada) |

### Serviços Principais

#### 1. **Criação de Triagem** (Paciente)
```typescript
// src/services/triagemService.ts
export const criarTriagem = async (
  dados: Partial<TriagemData>,
  imageUris: string[] = [],
  pacienteId?: string
): Promise<ServiceResult<Triagem>>
```

**Comportamento:**
- Status inicial: `triagem_pendente_secretaria` ✅
- Não requer `dentista_id` (será atribuído por secretária)
- Aguarda validação de secretária

#### 2. **Atribuições da Secretária**
```typescript
// src/services/secretarioService.ts

// Atribuir triagem a um dentista
export const atribuirTriagemAoDentista = async (
  triagemId: string,
  dentistaId: string,
  secretarioId: string,
  observacoes?: string
): Promise<{ success: boolean; error?: string }>

// Recusar triagem (dados inválidos, etc)
export const recusarTriagem = async (
  triagemId: string,
  secretarioId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }>

// Buscar novas triagens na fila
export const buscarTriagensPendentesSecretaria = async (): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}>
```

#### 3. **Dashboard da Secretária**
- Local: `src/screens/secretario/SecretarioDashboardScreen.tsx`
- **Nova Aba:** Filas de Triagens Pendentes
- Mostra triagens com status `triagem_pendente_secretaria`
- Organizado por: data, urgência, especialidade  
- Ações disponíveis:
  - ✅ Atribuir a Dentista
  - ❌ Recusar com motivo

---

## 2️⃣ FLUXO DE AGENDAMENTO

### Ciclo de Vida de um Agendamento

| Status | Ator | Ação | Próximo Status |
|--------|------|------|---|
| `agendamento_pendente_secretaria` | Sistema (padrão) | Agendamento solicitado | — |
| `agendamento_pendente_secretaria` | Secretária | ✅ Atribui a dentista + data/hora | `atribuido_dentista` |
| `agendamento_pendente_secretaria` | Secretária | ❌ Rejeita | `cancelado` |
| `atribuido_dentista` | Dentista | Recebe agendamento | — |
| `confirmado_dentista` | Dentista | Confirma presença | — |
| `realizado` | Sistema | Consulta realizada | (encerrada) |
| `cancelado` | Múltiplos | Cancelado | (encerrada) |

### Serviços Principais

#### 1. **Criação de Agendamento** (Paciente)
```typescript
// src/services/agendamentoService.ts
export const criarAgendamento = async (
  dados: Omit<Agendamento, 'id' | 'created_at' | 'updated_at'>
): Promise<ServiceResult<Agendamento>>
```

**Comportamento:**
- Status inicial: `agendamento_pendente_secretaria` ✅
- Não requer `dentista_id` (será atribuído por secretária)
- Pode não ter `data_agendamento` (será definida por secretária)
- Aguarda validação e atribuição de secretária

#### 2. **Atribuições da Secretária**
```typescript
// src/services/secretarioService.ts

// Atribuir agendamento a um dentista + definir data/hora
export const atribuirAgendamentoAoDentista = async (
  agendamentoId: string,
  dentistaId: string,
  secretarioId: string,
  dataAgendamento?: string,
  horaAgendamento?: string,
  observacoes?: string
): Promise<{ success: boolean; error?: string }>

// Rejeitar agendamento 
export const rejeitarAgendamento = async (
  agendamentoId: string,
  secretarioId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }>

// Buscar novos agendamentos na fila
export const buscarAgendamentosPendentesSecretaria = async (): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}>
```

#### 3. **Dashboard da Secretária**
- **Nova Aba:** Filas de Agendamentos Pendentes
- Mostra agendamentos com status `agendamento_pendente_secretaria`
- Organizado por: data de solicitação, urgência
- Ações disponíveis:
  - ✅ Atribuir a Dentista (com data/hora)
  - ❌ Rejeitar com motivo

---

## 🔄 TIPOS ATUALIZADOS

### TriagemStatus
```typescript
// src/types/triagem.ts
export type TriagemStatus =
  | 'triagem_pendente_secretaria'  // ✨ NOVO
  | 'pendente'
  | 'em_triagem'
  | 'respondida'
  | 'recusada'
  | 'cancelada';
```

### AppointmentStatus
```typescript
// src/types/appointment.ts
export type AppointmentStatus =
  | 'solicitado'
  | 'agendamento_pendente_secretaria'  // ✨ NOVO
  | 'em_triagem'
  | 'aguardando_dentista'
  | 'atribuido_dentista'              // ✨ NOVO
  | 'confirmado_dentista'
  | 'rejeitado_dentista'
  | 'reagendamento_solicitado'
  | 'notificado_paciente'
  | 'confirmado_paciente'
  | 'realizado'
  | 'cancelado';
```

### TriagemData (expandido)
```typescript
// src/types/triagem.ts
export interface TriagemData {
  paciente_id?: string;
  dentista_id?: string;
  secretario_id?: string;              // ✨ NOVO - quem atribuiu
  status?: TriagemStatus;
  motivo_recusa?: string;              // ✨ NOVO - se recusada
  // ... outros campos
}
```

---

## 📱 TELAS ATUALIZADAS

### SecretarioDashboardScreen
**Local:** `src/screens/secretario/SecretarioDashboardScreen.tsx`

**Novas Funcionalidades:**
1. Aba "Fila de Triagens" (status = `triagem_pendente_secretaria`)
2. Aba "Fila de Agendamentos" (status = `agendamento_pendente_secretaria`)
3. Contadores em tempo real
4. Sugestão automática de especialidade por sintomas
5. Botões de ação:
   - Atribuir/Rejeitar triagens
   - Atribuir data/hora/Rejeitar agendamentos

### AtribuirDentistaScreen
**Local:** `src/screens/secretario/AtribuirDentistaScreen.tsx`

Pode ser usado para:
- ✅ Atribuir triagens a dentistas
- ✅ Atribuir agendamentos a dentistas (com seleção de data/hora)

---

## 🔐 PERMISSÕES E RLS

### Quem pode fazer o quê?

| Ação | Paciente | Secretária | Dentista | Admin |
|------|----------|-----------|----------|-------|
| Criar triagem | ✅ | ❌ | ❌ | ✅ |
| Ver triagens pendentes | ❌ | ✅ | ❌ | ✅ |
| Atribuir triagem | ❌ | ✅ | ❌ | ✅ |
| Recusar triagem | ❌ | ✅ | ❌ | ✅ |
| Criar agendamento | ✅ | ❌ | ❌ | ✅ |
| Ver agendamentos pendentes | ❌ | ✅ | ❌ | ✅ |
| Atribuir agendamento | ❌ | ✅ | ❌ | ✅ |
| Rejeitar agendamento | ❌ | ✅ | ❌ | ✅ |
| Responder triagem | ❌ | ❌ | ✅ | ✅ |
| Confirmar agendamento | ❌ | ❌ | ✅ | ✅ |

---

## 🗄️ ALTERAÇÕES NO BANCO (Supabase)

### Tabela: `triagens`
**Colunas adicionadas/modificadas:**
- `status` enum: adicionar `'triagem_pendente_secretaria'` ✨
- `secretario_id` UUID (FK → profiles) ✨
- `motivo_recusa` TEXT ✨

### Tabela: `agendamentos`
**Colunas adicionadas/modificadas:**
- `status` enum: adicionar `'agendamento_pendente_secretaria'`, `'atribuido_dentista'` ✨
- `secretario_id` UUID (FK → profiles) ✨

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Atualizar tipos TypeScript
2. ✅ Modificar serviços de criação (triagem, agendamento)
3. ✅ Adicionar funções de aprovação/rejeição
4. ✅ Atualizar dashboard da secretária
5. ⏳ Testar fluxo completo
6. ⏳ Adicionar notificações (email/SMS) para secretária
7. ⏳ Adicionar RLS no Supabase
8. ⏳ Documentação para usuários finais

---

## 📝 EXEMPLO DE USO

### Paciente cria triagem
```typescript
// Tela do paciente
const resultado = await criarTriagem({
  paciente_id: pacienteId,
  sintoma_principal: "Dor intensa",
  descricao: "Dor intensificada à mastigação",
  intensidade_dor: 8,
  // Não precisa de dentista_id!
}, imageUris, pacienteId);

// Status inicial: "triagem_pendente_secretaria" ✨
```

### Secretária revisa e atribui
```typescript
// Dashboard secretária
const resultado = await atribuirTriagemAoDentista(
  triagemId,
  dentistaIdSelecionado,
  secretariaId,
  "Caso urgente de dor"
);

// Status agora: "pendente"
// Dentista recebe a triagem
```

---

## 🔗 Liação de Arquivos

- **Tipos:** `src/types/triagem.ts`, `src/types/appointment.ts`
- **Serviços:** `src/services/triagemService.ts`, `src/services/secretarioService.ts`, `src/services/agendamentoService.ts`
- **Telas:** `src/screens/secretario/SecretarioDashboardScreen.tsx`
- **Navegação:** `src/navigation/types.ts`

---

## ✨ Benefícios

1. **Validação Centralizada:** Secretária valida dados antes de atribuir
2. **Distribuição Inteligente:** Secretária escolhe melhor dentista para cada caso
3. **Controle de Carga:** Secretária balancea carga entre dentistas
4. **Segurança:** Evita agendamentos duplos ou inválidos
5. **Conformidade:** Garante processo padronizado para todos os casos
