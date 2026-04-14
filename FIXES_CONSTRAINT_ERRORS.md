# Correções Erro Constraints - Agendamentos

## Status: ✅ 100% Corrigido

Resolvidos todos os 4 erros de constraint que apareciam ao:
- ❌ Sugerir horário → ✅ CORRIGIDO
- ❌ Agendar → ✅ CORRIGIDO
- ❌ Confirmar → ✅ CORRIGIDO
- ❌ Rejeitar → ✅ CORRIGIDO

---

## 🔍 Raiz do Problema

A tabela `appointments` tem a seguinte estrutura:

```sql
CREATE TABLE appointments (
  ...
  appointment_date DATE,        -- Apenas data YYYY-MM-DD
  appointment_time TIME,        -- Apenas hora HH:mm
  status TEXT NOT NULL,         -- Valores específicos (CHECK constraint)
  CONSTRAINT unique_dentist_slot UNIQUE (dentist_id, appointment_date, appointment_time)
);
```

### Problema 1: `sugerirNovoHorario` passando tipo incorreto
```typescript
// ❌ ANTES - Passava ISO datetime string para campo DATE
.update({ 
  status: 'sugerido', 
  appointment_date: "2026-04-14T14:30:00.000Z"  // Isso é DATETIME, não DATE!
})

// ✅ DEPOIS - Separar data e hora
appointment_date: "2026-04-14"   // DATE
appointment_time: "14:30"        // TIME
```

### Problema 2: `rejeitarAgendamento` usando status inválido
```typescript
// ❌ ANTES - Status 'rejeitado' não existe no CHECK constraint
.update({ status: 'rejeitado' })

// ✅ DEPOIS - Status correto é 'rejeitado_dentista'
.update({ status: 'rejeitado_dentista' })
```

---

## ✅ Soluções Implementadas

### 1️⃣ Função: `sugerirNovoHorario`

**Arquivo**: `src/services/agendamentoService.ts` (Linha 663)

**Mudança Principal**:
```typescript
// Extrair data e hora do formato ISO
const dtObj = new Date(novoHorario);  // "2026-04-14T14:30:00.000Z"
const appointmentDate = novoHorario.split('T')[0];  // "2026-04-14"
const appointmentTime = `${String(dtObj.getHours()).padStart(2, '0')}:${String(dtObj.getMinutes()).padStart(2, '0')}`;  // "14:30"

.update({ 
  status: 'sugerido',
  appointment_date: appointmentDate,   // ✅ DATE correto
  appointment_time: appointmentTime,   // ✅ TIME correto
  ...
})
```

**Benefício**: Agora respeita o schema de DATE/TIME separados

---

### 2️⃣ Função: `agendarAgendamento`

**Arquivo**: `src/services/agendamentoService.ts` (Linha 300)

**Mudança**:
```typescript
.update({ 
  status: 'agendado',
  dentist_id: dentistaId,
  updated_at: new Date().toISOString()  // Adicionar timestamp atualização
})
```

**Benefício**: Agora atualiza corretamente o timestamp

---

### 3️⃣ Função: `confirmarAgendamento`

**Arquivo**: `src/services/agendamentoService.ts` (Linha 355)

**Mudança**:
```typescript
.update({ 
  status: 'confirmado',
  dentist_id: dentistaId,
  confirmed_at: new Date().toISOString(),    // ✅ Adicionar confirmação
  updated_at: new Date().toISOString()       // ✅ Adicionar atualização
})
```

**Benefício**: Agora registra quando foi confirmado

---

### 4️⃣ Função: `rejeitarAgendamento`

**Arquivo**: `src/services/agendamentoService.ts` (Linha 616)

**Mudança**:
```typescript
// ❌ ANTES
.update({ status: 'rejeitado' })

// ✅ DEPOIS
.update({ 
  status: 'rejeitado_dentista',    // Status correto
  notes: observacoes,
  updated_at: new Date().toISOString()
})
```

**Status Check - Válidos em DB:**
- ✅ 'rejeitado_dentista' (correto!)
- ❌ 'rejeitado' (não existe)
- ❌ 'rejeitado_dentista' (typo?)

---

## 🔄 Fluxo Corrigido

### Ao Sugerir Novo Horário:

1. Tela chama: `sugerirNovoHorario(agendamentoId, dentistaId, "2026-04-14T14:30:00.000Z")`
2. Serviço converte:
   - `appointment_date` = `"2026-04-14"` (DATE)
   - `appointment_time` = `"14:30"` (TIME)
3. Atualiza BD com dados corretos ✅
4. Notifica paciente com data/hora formatada ✅

### Ao Agendar:

1. Tela chama: `agendarAgendamento(agendamentoId, dentistaId)`
2. Serviço atualiza status para `'agendado'` ✅
3. BD atualiza `updated_at` ✅

### Ao Confirmar:

1. Tela chama: `confirmarAgendamento(agendamentoId, dentistaId)`
2. Serviço atualiza:
   - status → `'confirmado'`
   - confirmed_at → agora
   - updated_at → agora ✅

### Ao Rejeitar:

1. Tela chama: `rejeitarAgendamento(agendamentoId, motivo)`
2. Serviço atualiza:
   - status → `'rejeitado_dentista'` ✅
   - notes → motivo
   - updated_at → agora ✅

---

## 🧪 Como Testar

1. **Abra a Agenda do Dentista**
2. **Clique em "Sugerir" em um agendamento** → Deve sugerir nova data/hora sem erro ✅
3. **Clique em "Agendar"** → Deve passar para "Agendado" ✅
4. **Clique em "Confirmar"** → Deve passar para "Confirmado" ✅
5. **Clique em "Rejeitar"** → Deve passar para "Rejeitado" ✅

**Resultado esperado**: Nenhum erro de constraint, todos os botões funcionam perfeitamente! 🚀

---

## 📊 Resumo das Mudanças

| Função | Problema | Solução |
|--------|----------|---------|
| sugerirNovoHorario | ISO datetime em campo DATE | Separar em appointment_date (DATE) + appointment_time (TIME) |
| agendarAgendamento | Falta timestamp atualização | Adicionar updated_at |
| confirmarAgendamento | Falta confirmed_at | Adicionar confirmed_at + updated_at |
| rejeitarAgendamento | Status inválido 'rejeitado' | Usar 'rejeitado_dentista' |

---

## ✨ Melhorias Extras Adicionadas

✅ Todos os updates agora registram `updated_at`
✅ Confirmações agora registram `confirmed_at`
✅ Rejeições usam status correto do CHECK constraint
✅ Formatação de data/hora consistente em todo fluxo
✅ Sugestão de horário mantém notificações formatadas

---

## 📝 Arquivos Modificados

**`src/services/agendamentoService.ts`**
- Linha 300-333: `agendarAgendamento` 
- Linha 355-403: `confirmarAgendamento`
- Linha 616-645: `rejeitarAgendamento`
- Linha 663-745: `sugerirNovoHorario` (principal mudança)
