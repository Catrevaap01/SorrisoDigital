# 📋 FICHA TÉCNICA COMPLETA - TeOdonto Angola v1.2.0

**Data:** Atualizado em 18/05/2026  
**Cobertura:** 100% de todos ficheiros (200+) e funcionalidades  
**Status:** Produção — Onboarding Paciente + Lembretes Multi-Canal + 0 erros TypeScript

---

## 1. 🎯 RESUMO EXECUTIVO

**TeOdonto Angola**: App odontológico completo Angola 🇦🇴  
**Usuários**: Pacientes (triagem/agendamento), Dentistas (agenda/relatórios), Secretários (gestão), Admins  
**Diferenciais**: Offline-first + PWA 100% + Realtime chat + Relatórios PDF/CSV + Lembretes automáticos 24h

```
❌ NÃO: Credenciais hardcoded, UI inconsistente, sem offline, sem lembretes fiáveis
✅ SIM: Arquitetura modular, RLS Supabase, components reutilizáveis, PWA Lighthouse 100,
        lembretes multi-canal com worker em background + deduplicação via reminder_log
```

---

## 2. 🏗️ STACK & TECNOLOGIAS

| Camada | Tecnologia | Versão | Propósito |
|--------|------------|--------|-----------|
| **Frontend** | React Native + Expo | 0.81.5 / 54 | App nativo + Web |
| **Navegação** | React Navigation | 7.x | Tabs/Stack role-based |
| **Estado** | React Contexts | Auth/Dentista/Theme/Network | Global state |
| **Backend** | Supabase | PostgreSQL/Auth/RLS/Realtime | BaaS completo |
| **Email** | Supabase Edge Function + Resend | send-email v2 | Templates HTML ricos |
| **WhatsApp** | wa.me deep-link | — | Notificações diretas |
| **UI** | Custom components | Button/Input/Card/Loading | Reutilizáveis |
| **Offline/PWA** | Service Worker + AsyncStorage | v2 + hooks | 100% funcional |
| **Relatórios** | expo-print/sharing | PDF/CSV/JSON/HTML | Export avançado |
| **Lembretes** | reminderWorkerService | Background worker | 24h automático |
| **Outros** | expo-image-picker, QR SVG, Toast | Fotos/QR/notificações | Recursos nativos |

**Dependências Críticas** (package.json): `@supabase/supabase-js@2.97.0`, `expo-print@15`, `react-native-toast-message@2.3.3`, `@react-native-community/netinfo`

---

## 3. 📂 ESTRUTURA PROJETO (200+ ficheiros)

```
TeOdontoAngola/
├── App.tsx                          ← entry point (worker de lembretes integrado)
├── package.json (37 deps)
├── .vscode/
│   ├── settings.json                ← Deno ativo só em supabase/functions ✨
│   └── extensions.json              ← Recomenda extensão Deno ✨
│
📁 src/
├── components/
│   ├── Card.tsx, NetworkSyncStatus.tsx
│   └── ui/Button.tsx, Input.tsx, Loading.tsx
├── config/supabase.ts
├── contexts/AuthContext.tsx, ThemeContext, DentistContext, NetworkContext, RealtimeContext
├── hooks/
│   ├── useNetworkSync.ts, useDentistas.ts
│   └── useRealTimeMessages.ts
├── navigation/AppNavigator.tsx (role-based)
├── screens/ (60+ telas)
│   ├── admin/AdminDashboardScreen.tsx
│   ├── dentista/GerirPacientesScreen.tsx
│   └── paciente/TriagemScreen.tsx (câmera 5 fotos)
├── services/ (22 serviços)
│   ├── reminderWorkerService.ts     ← NOVO ✨ Worker background 24h
│   ├── reminderService.ts           ← Orquestrador 4 canais
│   ├── emailService.ts              ← Edge Function + fallbacks
│   ├── localNotificationService.ts  ← Push + WhatsApp deep-link
│   ├── notificacoesService.ts       ← In-app (Supabase)
│   ├── agendamentoService.ts        ← CRUD + trigger lembretes
│   ├── offlineSyncService.ts        ← Fila offline
│   ├── relatorioService.ts          ← PDF/CSV
│   └── ...18 outros serviços
└── utils/
    ├── logger.ts, errorHandler.ts, validators.ts
    └── constants.ts (sintomas/províncias Angola)

📁 supabase/
└── functions/
    ├── deno.json                    ← Config Deno workspace ✨
    └── send-email/
        ├── index.ts                 ← REESCRITO v2 ✨ (Deno.serve + Resend + HTML templates)
        └── deno.json                ← Config Deno por função ✨

📁 docs/
├── REMINDER_LOG_SETUP.sql           ← NOVO ✨ Tabela deduplicação
├── EMAIL_EDGE_FUNCTION.md           ← Guia configuração Resend
└── ...23 outros guias

📁 web/ (PWA 100%)
├── service-worker.js (cache v2)
├── manifest.json (icons 48-1024px)
└── offline.html
```

---

## 4. 🔔 SISTEMA DE LEMBRETES (v1.1 — NOVO)

### Arquitetura Multi-Canal

```
reminderWorkerService.ts (background, 1x/hora)
    │
    ├─→ Busca appointments WHERE date = amanhã AND status IN (confirmado, atribuido...)
    │
    ├─→ Verifica reminder_log (evita duplicatas)
    │
    └─→ enviarLembretesConsulta() ──→ Canal 1: In-App (tabela notificacoes Supabase)
                                   ──→ Canal 2: Email (Edge Function send-email + Resend)
                                   ──→ Canal 3: WhatsApp deep-link (wa.me)
                                   ──→ Canal 4: Push local (expo-notifications / Web API)
```

### Garantias de Fiabilidade

| Mecanismo | Função |
|-----------|--------|
| **Worker periódico** | Ciclo a cada 1h — não depende de ação do utilizador |
| **reminder_log** | Tabela Supabase que regista envios — evita duplicatas |
| **Offline-aware** | Verifica NetInfo — adia ciclo se sem rede |
| **Fire-and-forget** | Falha de 1 canal não bloqueia os outros |
| **Startup automático** | `startReminderWorker()` no App.tsx → começa 5s após boot |
| **Cleanup** | `stopReminderWorker()` no unmount — sem memory leaks |

### Edge Function send-email (v2 — REESCRITA)

```typescript
// API moderna Deno.serve() — sem import { serve }
// Provider: Resend (RESEND_API_KEY em Supabase Secrets)
// Templates HTML ricos para todos os tipos:
//   appointment_reminder | dentist_welcome | password_recovery | new_message
// Fallback dev: retorna 200 sem bloquear app se sem provider
```

**Setup Resend (5 minutos):**
```
1. Criar conta em resend.com (plano gratuito: 3000 emails/mês)
2. Supabase Dashboard → Settings → Edge Functions → Secrets
3. Adicionar: RESEND_API_KEY = re_xxxxxxxxxxxx
4. Adicionar: FROM_EMAIL = "TeOdonto Angola <noreply@seudominio.com>"
5. supabase functions deploy send-email
```

---

## 5. 🔐 MELHORIAS IMPLEMENTADAS (Timeline Completa)

### **Mai 2026 — v1.1.0**
```
✅ REMINDER WORKER: Background service 24h automático (reminderWorkerService.ts)
✅ REMINDER LOG: Tabela SQL deduplicação (docs/REMINDER_LOG_SETUP.sql)
✅ EDGE FUNCTION v2: Reescrita com Deno.serve() + Resend + HTML templates ricos
✅ WHATSAPP: Deep-link wa.me nativo (Mobile) + nova tab (Web/PWA)
✅ VSCODE DENO: .vscode/settings.json + extensions.json (sem erros)
✅ APP.TSX: Limpo — worker integrado com start/stop automático
```

### **Fev 2026 — v1.0.0**
```
✅ ADMIN DASHBOARD: CRUD dentistas + relatórios consolidados
✅ CÂMERA TRIAGEM: 5 fotos (galeria/câmera) + validação
✅ PWA 100%: Service-worker v2 + offline.html + manifest completo
✅ OFFLINE SYNC: useNetworkSync + offlineSyncService
✅ NAVEGAÇÃO: Auto-redirect por tipo perfil (Paciente/Dentista/Admin/Secretário)
✅ RELATÓRIOS: PDF/CSV/JSON/HTML (dentista + admin stats)
✅ SEGURANÇA: .env vars + RLS fix (docs/*.sql)
✅ COMPONENTS: Button/Input/Card/Loading reutilizáveis
✅ HOOKS: useDentistas/useAgendamentos/useNetworkSync
✅ UTILS: logger/errorHandler/validators centralizados
```

---

## 6. 🗄️ BASE DE DADOS (Supabase)

### Schema Principal (RLS ativado)
```
profiles (*PK auth.users)
├── tipo: 'paciente'|'dentista'|'admin'|'secretario'
├── especialidade/crm (dentistas)
└── senha_alterada (force change)

appointments (paciente→dentista)
├── status: pendente|agendamento_pendente_secretaria|atribuido_dentista|
│           confirmado_dentista|realizado|cancelado|rejeitado_dentista
├── priority: normal|urgente
└── appointment_date, appointment_time

triagens (paciente→dentista?)
├── sintomas[] TEXT (8 opções)
├── fotos_urls[] (até 5 Storage)
└── status: pendente|respondido

messages (realtime)
└── conversations por pair paciente-dentista

notificacoes (in-app)
└── tipos: triagem_enviada|triagem_respondida|agendamento_atualizado|urgencia|...

reminder_log (deduplicação de lembretes) ← NOVO ✨
├── appointment_id → appointments.id
├── canal: 'in_app'|'email'|'whatsapp'|'push'
├── sucesso: boolean
└── sent_at: timestamptz
```

### Scripts Setup (docs/)
```
SUPABASE_SETUP.sql          (schema+RLS base)
REMINDER_LOG_SETUP.sql      (tabela deduplicação lembretes) ← NOVO ✨
CRIAR_ADMIN.md + scripts/create-admin.js
SUPABASE_RLS_FIX_*.sql     (correções)
admin_report_stats RPC      (stats admin)
```

---

## 7. 🚀 FLUXOS DE USO

### **Paciente** (HomeScreen →)
```
TriagemScreen → Câmera(5 fotos) → Submeter
ChooseDentistaScreen → AgendamentoScreen
MensagensScreen (realtime useRealTimeMessages)
HistoricoScreen + NotificacoesScreen
```

### **Dentista** (DashboardScreen →)
```
AgendaDentistaScreen (dia/semana)
GerirPacientesScreen (CRUD)
CasoDetalheScreen + PacienteHistoricoScreen
DentistaRelatorioScreen (export PDF/CSV)
```

### **Secretário** (SecretarioDashboard →)
```
Gerir agendamentos pendentes
Atribuir dentista
Confirmar/cancelar consultas → dispara lembretes automáticos ✨
```

### **Admin** (AdminDashboardScreen →)
```
Listar dentistas (busca/filtros)
AdminReportsScreen (% resposta triagens)
RelatorioScreen (geral por dentista)
```

---

## 8. 🌐 PWA & OFFLINE (Lighthouse ~100)

```
✅ Installable (manifest.json + icons 48/192/512/1024)
✅ Offline (service-worker.js v2 + precache)
✅ Fast (runtime caching + offline.html custom)
✅ NetworkSyncStatus.tsx (ícone sync)
✅ fila sync (offlineSyncService.ts)
✅ Worker lembretes: offline-aware — adia ciclo se sem rede ✨
```

**Teste**: `npx expo start --web` → DevTools → Lighthouse

---

## 9. 📊 RELATÓRIOS & EXPORTAÇÕES

```
relatorioService.ts (250+ linhas):
✅ Dentista: triagens respondidas/pendentes/%
✅ Admin: Total dentistas/pacientes/triagens + stats[]
✅ Formatos: PDF (print), CSV (Excel), JSON (API), HTML (web)
✅ pdfReportService.ts + expo-print/sharing
```

---

## 10. 🔧 CONFIG & BUILD

### Dev
```bash
npm install && npx expo start [--web]
npm run typecheck  # TS check
```

### Supabase (ordem de execução)
```
1. docs/SUPABASE_SETUP.sql
2. docs/REMINDER_LOG_SETUP.sql          ← NOVO ✨
3. node scripts/create-admin.js admin@...
4. supabase functions deploy send-email  ← Configurar RESEND_API_KEY primeiro
```

### Produção
```bash
eas build --platform all  # Expo EAS
```

---

## 11. 🛡️ SEGURANÇA & BEST PRACTICES

```
✅ RLS policies (admin read/write, dentista own data, secretário)
✅ senha_alterada force change (dentistas)
✅ validators.ts (email/tel/password/required)
✅ errorHandler.ts (tipos + msgs PT)
✅ logger.ts (DEBUG/INFO/ERROR)
✅ No console.log prod
✅ expo-secure-store (tokens)
✅ reminder_log RLS: apenas service_role insere, admins leem ✨
✅ Edge Function: sem chaves no cliente — RESEND_API_KEY em Supabase Secrets ✨
```

---

## 12. 📱 FEATURES NATIVAS

```
✅ Câmera/galeria (expo-image-picker → Storage)
✅ PDF gen/export (expo-print/sharing)
✅ QR login (react-native-qrcode-svg)
✅ Clipboard senhas temp (expo-clipboard)
✅ Push local 24h antes (expo-notifications / Web Notifications API) ✨
✅ WhatsApp deep-link (Linking nativo + wa.me web fallback) ✨
✅ Realtime chat (Supabase subscriptions)
```

---

## 13. 🧪 TESTES & QUALIDADE

```
✅ __tests__/validators.test.ts
✅ jest.config.js + setup
npm test -- --coverage
✅ TypeScript (tsconfig.json)
✅ No linter errors (FIXES_TS_ERRORS.md)
✅ Deno LSP configurado para supabase/functions (.vscode/) ✨
```

---

## 14. 📚 DOCS INTERNAS (Cobertura 100%)

```
✅ FICHA_TECNICA_COMPLETA.md (este ficheiro — atualizado v1.1.0)
✅ MELHORIAS_IMPLEMENTADAS.md (histórico)
✅ docs/RELATORIO_TECNICO.md (arquitetura)
✅ docs/EMAIL_EDGE_FUNCTION.md (guia Resend)
✅ docs/REMINDER_LOG_SETUP.sql (migração deduplicação) ✨
✅ START_HERE.md + CHECKLIST.md (onboarding)
✅ TODO.md (progress tracker)
✅ docs/CRIAR_ADMIN.md + 20+ SQL guias
✅ ESTRUTURA_PROJETO.txt (mapa ficheiros)
```

---

**FICHA v1.1.0 COMPLETA** — Sistema de lembretes multi-canal implementado e documentado.  
Todos os ficheiros/funcionalidades cobertos (200+ ficheiros).
