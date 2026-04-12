# 📋 Ordem de Execução - Setup Supabase

## ✅ Arquivo Único (Recomendado)

Execute **APENAS UM ARQUIVO** em ordem:

### 1️⃣ `SETUP_COMPLETO.sql` 
**Versão 100% completa — Cria o banco inteiro do zero**
- ✨ Cria TUDO: tabelas, RLS, funções, índices
- 🔹 PARTE 0: Extensões PostgreSQL
- 🔹 PARTE 1: Tabelas base (Províncias + Profiles)
- 🔹 PARTE 2: Triagens + Appointments + Respostas
- 🔹 PARTE 3: Módulo Clínico (Anamneses, Planos, Procedimentos, Evoluções, Prescrições)
- 🔹 PARTE 4: Comunicação (Conversations + Messages)
- 🔹 PARTE 5: Ativar RLS
- 🔹 PARTE 6: Funções Auxiliares (is_admin, is_secretario, is_healthcare_pro, etc)
- 🔹 PARTE 7: Políticas RLS para TODOS os tipos de usuário
- 🔹 PARTE 8: Verificação Final (listar tabelas criadas)

**Onde executar:** Supabase Dashboard > SQL Editor > New Query

---

## 📝 Estrutura Interna do SETUP_COMPLETO.sql

```
PARTE 0 — Extensões
  └─ pgcrypto, uuid-ossp

PARTE 1 — Tabelas Base
  ├─ provincias (18 províncias de Angola)
  └─ profiles (paciente, dentista, medico, secretario, admin)

PARTE 2 — Triagem e Agendamento
  ├─ triagens (avaliação inicial do paciente)
  ├─ appointments (agendamentos atribuídos por secretário)
  └─ respostas_triagem (resposta do dentista à triagem)

PARTE 3 — Módulo Clínico
  ├─ anamneses (histórico médico do paciente)
  ├─ planos_tratamento (plano clínico)
  ├─ procedimentos_tratamento (procedimentos específicos)
  ├─ evolucoes_clinicas (progresso do tratamento)
  └─ prescricoes (receitas digitais)

PARTE 4 — Comunicação
  ├─ conversations (conversa entre 2 profissionais/pacientes)
  └─ messages (mensagens na conversa)

PARTE 5 — RLS
  └─ Ativa Row Level Security em todas as tabelas

PARTE 6 — Funções
  ├─ is_admin() — verifica se é admin
  ├─ is_secretario() — verifica se é secretário
  ├─ is_healthcare_pro() — verifica se é profissional de saúde
  ├─ current_user_tipo() — retorna tipo do usuário atual
  └─ handle_new_user() — TRIGGER que cria profile automaticamente

PARTE 7 — Políticas RLS (por Tipo de Usuário)
  ├─ ADMIN: acesso completo a TUDO
  ├─ PACIENTE: vê suas próprias triagens, appointments, clínico
  ├─ DENTISTA/MÉDICO: vê triagens/appointments atribuídos, dados clínicos de pacientes
  ├─ SECRETÁRIO: vê TODAS as triagens, gerencia appointments
  └─ Comunicação: acesso apenas a conversas onde participa

PARTE 8 — Verificação
  ├─ Conta tabelas criadas (deve ser 12)
  └─ Lista tipos de usuário disponíveis
```

---

## 🔐 Permissões por Tipo de Usuário

| Tipo | Triagens | Appointments | Clínico | Outras Comunicação | Admin |
|------|----------|--------------|---------|-------------------|-------|
| **paciente** | Próprias | Próprios | Próprios dados | Conversas | ❌ |
| **dentista** | Atribuídas | Atribuídos | Dados pacientes | Conversas | ❌ |
| **medico** | Atribuídas | Atribuídos | Dados pacientes | Conversas | ❌ |
| **secretario** | **TODAS** | **Gerencia TUDO** | Visualiza | Conversas | ❌ |
| **admin** | **TUDO** | **TUDO** | **TUDO** | **TUDO** | ✅ |

---

## ✅ O que Cada Tipo de Usuário Pode Fazer

### 👤 PACIENTE
- ✅ Submeter triagens (sintomas, descrição)
- ✅ Ver suas triagens e respostas
- ✅ Ver seus agendamentos confirmados
- ✅ Ver seus dados clínicos (anamnese, prescrições)
- ✅ Fazer mensagens para dentista

### 🦷 DENTISTA / MÉDICO
- ✅ Ver TODAS as triagens atribuídas
- ✅ Responder triagens com orientações
- ✅ Ver agendamentos suas para ele
- ✅ Gerenciar dados clínicos de pacientes:
  - Criar anamneses
  - Criar planos de tratamento
  - Registrar procedimentos
  - Registrar evoluções
  - Prescrever medicamentos
- ✅ Fazer mensagens para pacientes

### 📋 SECRETÁRIO
- ✅ Ver **TODAS as triagens** (independente de status)
- ✅ **Atribuir dentista** a uma triagem
- ✅ **Gerenciar agendamentos**:
  - Ver todos
  - Agendar data/hora
  - Marcar como completado
  - Cancelar se necessário
- ✅ Auto-completar dados de pacientes
- ✅ Rejeitar triagens com motivo
- ❌ NÃO pode fazer procedimentos clínicos

### 👨‍💼 ADMIN
- ✅ **ACESSO TOTAL** a TUDO
- ✅ Ver/editar todos usuarios
- ✅ Ver/editar todas triagens
- ✅ Ver/editar todos agendamentos
- ✅ Ver/editar todos dados clínicos
- ✅ Gerenciar comunicações

---

## ⚙️ Pré-requisitos

Antes de executar `SETUP_COMPLETO.sql`, certifique-se que:

1. ✅ Banco Supabase criado e conectado
2. ✅ Nenhuma tabela anterior (o script deleta se necessário)
3. ✅ Auth Supabase ativado
4. ✅ SSH/RLS policy ready

---

## 🚀 Próximos Passos Após Setup

### 1. Criar Usuários
**Arquivo:** `CRIAR_ADMIN.md`
- Criar admin inicial
- Criar secretários
- Criar dentistas

### 2. Configurar Edge Functions (Email)
**Arquivo:** `EMAIL_EDGE_FUNCTION.md`
- Setup para enviar emails
- Confirmação de agendamento
- Lembretes de consulta

### 3. Validar Funcionalidades
**Arquivo:** `VALIDACAO_FUNCIONALIDADES.md`
- Testar fluxo paciente
- Testar fluxo secretário
- Testar fluxo dentista

### 4. Guia Rápido
**Arquivo:** `ADMIN_QUICKSTART.md`
- Primeiro acesso
- Primeiros agendamentos

---

## 📊 Tabelas Criadas (12 no total)

1. `provincias` — 18 províncias de Angola
2. `profiles` — Usuários (5 tipos)
3. `triagens` — Avaliações iniciais
4. `appointments` — Agendamentos
5. `respostas_triagem` — Respostas do dentista
6. `anamneses` — Histórico médico
7. `planos_tratamento` — Planos clínicos
8. `procedimentos_tratamento` — Procedimentos
9. `evolucoes_clinicas` — Progresso
10. `prescricoes` — Receitas digitais
11. `conversations` — Conversas
12. `messages` — Mensagens

---

## 🐛 Troubleshooting

### "Error: relation 'profiles' already exists"
**Solução:** Limpar banco antes de correr o script
```sql
-- No Supabase SQL Editor:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Depois correr SETUP_COMPLETO.sql completo
```

### "Error: function is_admin() already exists"
**Solução:** O script tem DROP IF EXISTS, pode correr novamente sem problema

### "RLS policy conflict"
**Solução:** Verificar que todas policies foram removidas antes
```sql
SELECT * FROM pg_policies WHERE schemaname='public';
```

---

## 📞 Dúvidas?

Ver `RELATORIO_TECNICO.md` para mais detalhes arquiteturais.
