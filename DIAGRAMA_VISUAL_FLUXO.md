# 🎨 Diagrama Visual do Fluxo de Secretária

## 1. Fluxo Completo: Triagem

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE TRIAGEM                               │
└─────────────────────────────────────────────────────────────────────┘

  👤 PACIENTE                    📋 SECRETÁRIA                  👨‍⚕️ DENTISTA
  ──────────────────────────────────────────────────────────────────────

                                 
  1️⃣ Cria Triagem              
     (criarTriagem)
          │
          ├─► Status: 'triagem_pendente_secretaria' ✨
          │
          ▼
     📝 Armazenado no banco
                                                      
                                 2️⃣ Vê na Fila
                                 (buscarTriagensPendentesSecretaria)
                                      │
                                      ├─► Triagens ordenadas por:
                                      │   • Data ⏰
                                      │   • Urgência 🔴🟡🟢
                                      │   • Especialidade 🦷
                                      │
                                      ▼
                                 📋 Painel Secretária
                                 
                                 ┌──────┐
                                 │ ✅   │  Aprovar
                                 └──────┘
                                    │
                                    ├─► atribuirTriagemAoDentista()
                                    │
                                    ▼
                                 Status: 'pendente' ✨
                                 dentista_id: 'xxx'
                                 secretario_id: 'yyy'
                                 
                                                   3️⃣ Recebe Triagem
                                                   (buscarTriagensPendentes)
                                                        │
                                                        ├─► Avalia
                                                        │   • Sintomas
                                                        │   • Descrição
                                                        │   • Imagens
                                                        │
                                                        ▼
                                                   Status: 'respondida' ✨
                                                   (dentista responde)

                                 ┌──────┐
                                 │ ❌   │  Rejeitar
                                 └──────┘
                                    │
                                    ├─► recusarTriagem()
                                    │   (motivo: "dados incompletos")
                                    │
                                    ▼
                                 Status: 'recusada' ✨
                                 motivo_recusa: 'xxx'
                                 
                                 
   👤 Paciente recebe notificação de rejeição
      e pode reenviar com dados completos
```

---

## 2. Fluxo Completo: Agendamento

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE AGENDAMENTO                           │
└─────────────────────────────────────────────────────────────────────┘

  👤 PACIENTE                    📋 SECRETÁRIA                  👨‍⚕️ DENTISTA
  ──────────────────────────────────────────────────────────────────────

                                 
  1️⃣ Solicita Agendamento      
     (criarAgendamento)
          │
          ├─► Status: 'agendamento_pendente_secretaria' ✨
          │
          ├─► Sem dentista_id
          ├─► Sem data/hora
          │
          ▼
     📅 Armazenado no banco
                                                      
                                 2️⃣ Vê na Fila
                                 (buscarAgendamentosPendentesSecretaria)
                                      │
                                      ├─► Agendamentos ordenados por:
                                      │   • Data de solicitação ⏰
                                      │   • Urgência 🔴🟡🟢
                                      │
                                      ▼
                                 📋 Painel Secretária
                                 
                                 ┌──────────────┐
                                 │ ✅           │  Aprovar + Agendar
                                 └──────────────┘
                                    │
                                    ├─► Seleciona Dentista
                                    │   └─► Mostra disponibilidade
                                    │
                                    ├─► Define Data
                                    │   └─► Calendário
                                    │
                                    ├─► Define Hora
                                    │   └─► Slots disponíveis
                                    │
                                    ├─► atribuirAgendamentoAoDentista()
                                    │
                                    ▼
                                 Status: 'atribuido_dentista' ✨
                                 dentista_id: 'xxx'
                                 data_agendamento: '2026-04-15'
                                 hora_agendamento: '10:00'
                                 secretario_id: 'yyy'
                                 
                                                   3️⃣ Recebe Agendamento
                                                   (com data/hora definida)
                                                        │
                                                        ├─► Confirmado
                                                        │
                                                        ▼
                                                   Status: 'confirmado_dentista' ✨
                                                   
                                                   
                                                   4️⃣ Consulta Realizada
                                                        │
                                                        ▼
                                                   Status: 'realizado' ✨

                                 ┌──────┐
                                 │ ❌   │  Rejeitar
                                 └──────┘
                                    │
                                    ├─► rejeitarAgendamento()
                                    │   (motivo: "desculpa")
                                    │
                                    ▼
                                 Status: 'cancelado' ✨
                                 observacoes: 'Rejeitado: xxx'
                                 
                                 
   👤 Paciente recebe notificação de rejeição
      e pode tentar agendar novamente
```

---

## 3. Estados e Transições

### Estados de Triagem

```
┌─────────────────────────────────────────────────────────────┐
│                    TRIAGEM STATES                           │
└─────────────────────────────────────────────────────────────┘

START
  │
  ├─► 'triagem_pendente_secretaria' ◄─── Paciente envia triagem
  │                   │
  │                   ├─► [ATRIBUIR] ──► 'pendente' ──► [DENTISTA RESPONDE]
  │                   │                                       │
  │                   │                                       ├─► 'em_triagem'
  │                   │                                       │
  │                   │                                       └─► 'respondida'
  │                   │
  │                   └─► [REJEITAR] ──► 'recusada' ──► [PACIENTE RESUBMETE]
  │                                             │
  │                                             └─► [CANCELADA]
  │
  └─► [CANCELADA] ◄─── Sistema cancela por inatividade
```

### Estados de Agendamento

```
┌─────────────────────────────────────────────────────────────┐
│                 AGENDAMENTO STATES                          │
└─────────────────────────────────────────────────────────────┘

START
  │
  ├─► 'agendamento_pendente_secretaria' ◄─── Paciente solicita
  │                       │
  │                       ├─► [ATRIBUIR] ──► 'atribuido_dentista'
  │                       │                        │
  │                       │                        ├─► 'confirmado_dentista'
  │                       │                        │
  │                       │                        ├─► 'realizado'
  │                       │                        │
  │                       │                        └─► 'cancelado'
  │                       │
  │                       └─► [REJEITAR] ──► 'cancelado' ──► [PACIENTE REVALIDA]
  │
  └─► [CANCELADA] ◄─── Sistema cancela por inatividade
```

---

## 4. Dados Fluxo

### Colunas Afetadas

```
┌─────────────────────────────────────────────────────────────┐
│            TABELAS DO BANCO                                 │
└─────────────────────────────────────────────────────────────┘

TABELA: triagens
├─ id (PK)
├─ paciente_id (FK)
├─ dentista_id (FK) ◄─── Cria com NULL, secretária atribui
├─ secretario_id (FK) ◄─── NOVO: quem atribuiu
├─ status ◄─── NOVO: enum 'triagem_pendente_secretaria'
├─ motivo_recusa ◄─── NOVO: por que foi rejeitada
├─ sintoma_principal
├─ descricao
├─ intensidade_dor
├─ created_at
└─ updated_at


TABELA: agendamentos
├─ id (PK)
├─ patientId (FK)
├─ dentista_id (FK) ◄─── Cria com NULL, secretária atribui
├─ secretario_id (FK) ◄─── NOVO: quem atribuiu
├─ status ◄─── NOVO: enum 'agendamento_pendente_secretaria'
├─ data_agendamento ◄─── Cria com NULL, secretária define
├─ hora_agendamento ◄─── Cria com NULL, secretária define
├─ urgency
├─ symptoms
├─ created_at
└─ updated_at
```

---

## 5. Fluxo de Dados API

### Criação de Triagem (Paciente)

```
POST /triagens
{
  "paciente_id": "patient-123",
  "sintoma_principal": "Dor intensa",
  "descricao": "...",
  "intensidade_dor": 8,
  "imagens": ["url1", "url2"]
}
        │
        ▼
ANTES: status = 'pendente'
DEPOIS: status = 'triagem_pendente_secretaria' ✨
        dentista_id = NULL
        secretario_id = NULL
        │
        ▼
Salvo no banco
```

### Atribuição de Triagem (Secretária)

```
PUT /triagens/{id}
{
  "dentista_id": "dentist-456",
  "secretario_id": "secretary-789",
  "status": "pendente",
  "observacoes": "Caso urgente"
}
        │
        ▼
STATUS: 'triagem_pendente_secretaria' ──► 'pendente' ✨
        │
        ├─ dentista_id: NULL ──► "dentist-456"
        ├─ secretario_id: NULL ──► "secretary-789"
        │
        ▼
Dentista notificado
```

---

## 6. Componentes UI

```
┌────────────────────────────────────────────────────────────┐
│              DASHBOARD SECRETÁRIA                          │
└────────────────────────────────────────────────────────────┘

[Dashboard] [Relatórios] [Senhas] [Perfil] [📋 FILAS] ◄─── NEW

┌────────────────────────────────────────────────────────────┐
│ Triagens Pendentes (3)              Agendamentos (2)       │
├─────────────────────┬──────────────────────────────────────┤
│ 👤 João Silva       │ 👤 Maria Santos                     │
│ Dor intensa (9/10)  │ Avaliação / Alta                    │
│ "Dor ao mastigar"   │ Solicitado há 2h                    │
│ [Rejeitar][Atrib]   │ [Rejeitar][Atrib + Data/Hora]       │
├─────────────────────┼──────────────────────────────────────┤
│ 👤 Carlos           │ 👤 Ana Costa                         │
│ Sangramento (7/10)  │ Limpeza / Normal                    │
│ [Rejeitar][Atrib]   │ [Rejeitar][Atrib + Data/Hora]       │
├─────────────────────┼──────────────────────────────────────┤
│ 👤 Pedro            │                                      │
│ Inchaço (8/10)      │                                      │
│ [Rejeitar][Atrib]   │                                      │
└─────────────────────┴──────────────────────────────────────┘
```

---

## 7. Integração REST API (Exemplo)

```javascript
// Paciente cria triagem
const response = await fetch('/api/triagens', {
  method: 'POST',
  body: JSON.stringify({
    paciente_id: 'user-123',
    sintoma_principal: 'Dor',
    // ...
  })
});

// Response
{
  "id": "triagem-456",
  "status": "triagem_pendente_secretaria",  ✨
  "paciente_id": "user-123",
  "dentista_id": null,
  "secretario_id": null,
  "created_at": "2026-04-11T10:00:00Z"
}

// Secretária aprova
const approve = await fetch('/api/secretaria/atribuir-triagem', {
  method: 'POST',
  body: JSON.stringify({
    triagem_id: 'triagem-456',
    dentista_id: 'dentist-789',
    secretario_id: 'secretary-xyz',
    observacoes: 'Urgente'
  })
});

// Resposta
{
  "status": "pendente",  ✨
  "dentista_id": "dentist-789",
  "secretario_id": "secretary-xyz"
}
```

---

## 8. Fluxo Temporal (Timeline)

```
SEGUNDO A SEGUNDO

08:00:00 ────────────────────────────────────────────────────────
         👤 Paciente João abre app
         
08:02:15 ────────────────────────────────────────────────────────
         👤 Paciente preenche triagem
         👤 Clica "Enviar"
         
08:02:30 ────────────────────────────────────────────────────────
         📬 Triagem criada
         Status: 'triagem_pendente_secretaria' ✨
         
08:05:00 ────────────────────────────────────────────────────────
         📋 Secretária abre app
         📋 Vai para aba "Filas"
         📋 Vê 3 triagens esperando
         
08:06:45 ────────────────────────────────────────────────────────
         📋 Secretária clica "Atribuir" em triagem de João
         📋 Seleciona Dr. Carlos (Endodontia)
         
08:07:00 ────────────────────────────────────────────────────────
         📬 Triagem atribuída
         Status: 'pendente' ✨
         dentista_id: 'carlos-123' ✨
         
08:07:15 ────────────────────────────────────────────────────────
         👨‍⚕️ Dr. Carlos recebe notificação
         👨‍⚕️ Abre triagem de João
         
08:15:00 ────────────────────────────────────────────────────────
         👨‍⚕️ Dr. Carlos responde triagem
         Status: 'respondida' ✨
         
08:16:00 ────────────────────────────────────────────────────────
         👤 João recebe resposta do Dr. Carlos
         🎉 Problema resolvido!
```

---

## 9. Matriz de Permissões

```
┌──────────────────────────────────────────────────────────────┐
│             QUEM PODE FAZER O QUÊ                            │
└──────────────────────────────────────────────────────────────┘

AÇÃO                          PACIENTE  SECRET  DENT  ADMIN
─────────────────────────────────────────────────────────────
Ver minhas triagens              ✅      ❌     ❌    ✅
Ver triagens pendentes           ❌      ✅     ❌    ✅
Atribuir triagem                 ❌      ✅     ❌    ✅
Rejeitar triagem                 ❌      ✅     ❌    ✅

Ver meus agendamentos            ✅      ❌     ❌    ✅
Ver agendamentos pendentes       ❌      ✅     ❌    ✅
Atribuir agendamento             ❌      ✅     ❌    ✅
Rejeitar agendamento             ❌      ✅     ❌    ✅

Responder triagem                ❌      ❌     ✅    ✅
Confirmar agendamento            ❌      ❌     ✅    ✅
```

---

## 10. Contadores e Statisticas

```
DASHBOARD SECRETÁRIA - TOP BAR

┌─────────────┬──────────────┬─────────────┐
│   🔴 3      │    🟡 5      │    🟢 2     │
│  Urgentes   │   Normais    │  Baixas     │
│ Triagens    │ Agendamentos │ Processadas │
└─────────────┴──────────────┴─────────────┘

CLICÁVEL - Abre cada cate goria

Atualizações em tempo real a cada 10 segundos
```

---

## ✨ Resumo Visual

O fluxo novo é:

```
ANTES:
Paciente → Dentista ❌

DEPOIS:
Paciente → Secretária → Dentista ✅
           (validação + atribuição inteligente)
```

Benefício: **Centralização e Controle**! 🎯
