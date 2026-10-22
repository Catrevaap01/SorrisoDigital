# 🦷 FICHA TÉCNICA - TeOdonto Angola
**APRESENTAÇÃO para DEFESA/TUTOR/COLEGA** 📊

## 🎯 **O QUE É o Projeto?** (2 min)
**TeOdonto Angola** = **App mobile + Web PWA** completo para clínicas odontológicas:
```
👩‍⚕️ DENTISTAS: Agenda, pacientes, chat, relatórios
👤 PACIENTES: Triagem sintomas, agendar, histórico, mensagens
👨‍💼 ADMIN: Dashboard + relatórios gerais
🦷 RESULTADO: Clínica digital moderna Angola!
```

**Tech Stack SIMPLES**:
```
Frontend: React Native (Expo) + TypeScript
Banco: Supabase (PostgreSQL + Autenticação + Realtime)
PDF: HTML→PDF nativo (1 clique)
Deploy: Vercel (web) + Expo (iOS/Android)
```

## 🏗️ **Arquitetura Explicada** (3 min)
```
1️⃣ FRONTEND (React Native + Expo)
   ├── Contexts → Estado global (Auth, Dentista, Theme)
   ├── Hooks → Lógica reutilizável (useTriagens, useChat)
   ├── Services → API calls (pacienteService, fichaService)
   └── Screens → Telas por role (Paciente/Home, Dentista/Agenda)

2️⃣ BACKEND (Supabase - 0 código servidor!)
   ├── profiles → Usuários + roles (paciente/dentista/admin)
   ├── triagens → Sintomas + IA prioridade
   ├── agendamentos → Consultas marcadas
   └── mensagens → Chat realtime

3️⃣ FLUXO PRINCIPAL (Paciente → Dentista)
   Triagem → Agendar → Chat → Consulta → Relatório PDF
```

```
ESTRUTURA PROJETO:
TeOdontoAngola/
├── src/
│   ├── screens/paciente/    👤 Telas paciente
│   ├── screens/dentista/    👩‍⚕️ Telas dentista
│   ├── services/            🔌 API + PDF
│   └── utils/pdfExportUtils # 🖨️ GERAÇÃO FICHAS
├── docs/                    🗄️ SQL Supabase
└── package.json             📦 Expo + Supabase
```

## 🚀 **FUNCIONALIDADES Detalhadas** (5 min)
| Feature | Paciente | Dentista | Admin |
|---------|----------|----------|-------|
| **Autenticação** | Login/QR | Login | Login |
| **Triagem** | ✅ Sintomas+foto | 📋 Responder | 📊 Estatísticas |
| **Agenda** | 📅 Agendar | 📋 Gerenciar | - |
| **Chat** | 💬 Mensagens | 💬 Responder | - |
| **Fichas PDF** | 📄 Receber | ✅ Gerar | ✅ Relatórios |
| **Relatórios** | 📈 Histórico | 📊 Pessoais | 📊 Geral |

**🔥 Destaque Ficha PDF** (foco da otimização):
```
1. NovoPaciente → gera HTML (fichaService.ts)
2. Credenciais temp + QR auto-login (qrserver.com)
3. exportHtmlAsPdf() → 1 página A4 perfeita ✅
CSS: @page A4 + grid/flex compacto
```

## 🛠️ **Como FUNCIONA Tecnicamente?** (3 min)
```
1️⃣ SUPABASE Realtime:
   - Triagens: insert → dentista recebe push
   - Chat: broadcasts → mensagens instantâneas
   - RLS: dentista só vê SEUS pacientes

2️⃣ REACT NATIVE Expo:
   - Contexts: estado global sem Redux
   - Hooks: useRealTimeMessages(), useAgendamentos()
   - PDF: expo-print (HTML→PDF nativo)

3️⃣ DEPLOY FÁCIL:
   npx expo start  → Mobile + Web instantâneo
   vercel deploy   → PWA produção
```

## 📊 **ESTRUTURA Completa por Pasta/Arquivo**
*(detalhes técnicos abaixo)*

## 📁 src/ - Estrutura Principal

### components/
```
components/
├── Card.tsx                 # Cards reutilizáveis (pacientes/agendas)
├── ProfileEditModal.tsx     # Modal editar perfil dentista/paciente
└── ui/                      # Shadcn/UI components (Button, Input, Loading)
    ├── Button.tsx
    ├── Input.tsx
    └── Loading.tsx
```

### config/
```
config/
├── specialtyConfig.ts       # Lista especialidades dentárias (Ortodontia, Endodontia...)
└── supabase.ts              # Cliente Supabase inicializado
```

### contexts/
```
contexts/
├── AuthContext.tsx          # Autenticação (login/logout/roles)
├── DentistContext.tsx       # Dados dentista logado
└── ThemeContext.tsx         # Tema claro/escuro
```

### hooks/
```
hooks/
├── useAgendamentos.ts       # Agendamentos em tempo real
├── useConteudos.ts          # Conteúdos educativos
├── useDentistas.ts          # Lista dentistas
├── useRealTimeMessages.ts   # Chat realtime (Supabase broadcasts)
└── useTriagens.ts           # Triagens paciente/dentista
```

### navigation/
```
navigation/
├── AdminNavigator.tsx       # Telas admin (relatórios/dashboard)
├── AppNavigator.tsx         # Navegação principal por role
├── DentistaStackNavigator.tsx # Stack dentista (agenda/pacientes)
└── types.ts                 # Tipos TypeScript navegação
```

## 📁 **ESTRUTURA Completa** - Cada Pasta/Arquivo Explicado

### **PASTAS PRINCIPAIS** `src/`
| Pasta | O que faz | Arquivos principais |
|-------|-----------|-------------------|
| **components/** | UI reutilizável | `Card.tsx` (cards pacientes), `Button.tsx` shadcn |
| **config/** | Configurações | `supabase.ts` (banco), `specialtyConfig.ts` (ortodontia...) |
| **contexts/** | Estado global | `AuthContext.tsx` (login), `DentistContext.tsx` |
| **hooks/** | Lógica reutilizável | `useTriagens.ts`, `useRealTimeMessages.ts` (chat) |
| **navigation/** | Rotas app | `AppNavigator.tsx` (por role), `DentistaStack` |
| **screens/** | **TODAS telas** | paciente/, dentista/, admin/ |
| **services/** | **API + Banco** | `fichaService.ts` (PDF), `triagemService.ts` |
| **styles/** | CSS/Theme | `theme.ts` (azul odontologia) |
| **utils/** | Helpers | `pdfExportUtils.ts` (**GERA PDF**), `qrUtils.ts` |

### **SCREEN por SCREEN** (Telas = 80% código)
```
screens/paciente/ 👤 PACIENTE (principal)
├── HomeScreen.tsx          → Dashboard + botões rápidos
├── TriagemScreen.tsx       → ✅ Sintomas + foto + prioridade IA
├── AgendamentoScreen.tsx   → Escolher dentista + marcar
├── MensagensScreen.tsx     → Chat dentista↔paciente
└── HistoricoScreen.tsx     → Minhas triagens + fichas

screens/dentista/ 👩‍⚕️ DENTISTA
├── AgendaDentistaScreen.tsx → 📅 Agenda visual + agendamentos
├── GerirPacientesScreen.tsx → Lista pacientes + gerar ficha
├── DentistaMensagensScreen → Responder mensagens
└── gerarFichaHistorico.ts   → PDF histórico paciente

screens/admin/ 👨‍💼 ADMIN
└── AdminReportsScreen.tsx  → 📊 Dashboard + relatórios Excel
```

### **SERVICES** (Camada Dados - coração app)
```
services/fichaService.ts 👈 EDITADA
→ gerarFichaCadastroHTML() → HTML + email/senha + QR → PDF 1pág A4

services/pdfReportService.ts
→ exportarFichaPdf(html) → utils.exportHtmlAsPdf() → 📄 Compartilhar

services/triagemService.ts
→ POST triagem → Supabase realtime → Dentista recebe ALERTA
```

**Outros arquivos raiz**:
```
docs/SUPABASE_SETUP.sql     → Criar tabelas + RLS segurança
scripts/create-admin.js     → Criar admin primeiro acesso
package.json                → "expo-print", "@supabase/supabase-js"
```

### styles/
```
styles/
├── theme.ts                 # Tailwind-like + cores
└── themeColors.ts           # Paleta azul/verde odontologia
```

### utils/
```
utils/
├── constants.ts             # IDs/rotas fixas
├── pdfExportUtils.ts        # **GERAÇÃO PDF** (expo-print + HTML→PDF)
├── pdfExportUtils_fixed.ts  # Versão corrigida PDF utils
├── qrUtils.ts               # QR codes app (login auto-fill)
└── validators.ts            # Validações forms
```

## 🔧 Fluxo Ficha Paciente (Foco da Edição)
```
1. NovoPacienteScreen → chama fichaService.gerarFichaCadastroHTML()
2. Gera HTML com: dados paciente + email/senha temp + QR (qrserver.com)
3. pdfReportService.exportarFichaPdf(html) → utils.exportHtmlAsPdf()
4. PDF A4 1 página: **✅ Agora ajustado com fontes/padding reduzidos**

HTML estruturado CSS:
- @page A4 margin:0 + body padding 8mm (margens cabeçalho/rodapé)
- Credenciais: highlight monospace 16px (era 22px)
- QR: 100px compacto
- Sections grid/flex responsivo
```

## 🎓 **Para DEFESA/ENTREGA** - Slides prontos!

### **1. PROBLEMA Resolvido**
"Clínicas Angola: papelada, filas, sem agendamento digital → **TeOdonto resolve 100%**"

### **2. DEMO Rápida** (3 min)
```
1. Paciente: Triagem → Agendar → QR instala app
2. Dentista: Recebe triagem → Chat → Gerar ficha PDF
3. Admin: Relatório "Dr X: 85% triagens respondidas"
```

### **3. DIFERENCIAIS Técnicos**
```
✅ SUPABASE Backend-as-Service (0 servidor)
✅ Realtime nativo (triagens/chat instantâneo)
✅ PWA + Mobile único código
✅ PDF profissional 1-clique (HTML otimizado)
✅ RLS Segurança (dentista só vê seus dados)
✅ TypeScript 100% tipado
```

### **4. COMO RODAR** (tutor/colega)
```bash
# 1. Instalar
npm install

# 2. Config Supabase (.env EXPO_PUBLIC_SUPABASE_URL/KEY)
# 3. Criar admin
node scripts/create-admin.js

# 4. Rodar
npx expo start --web    # Chrome localhost:19006
# ou npx expo start      # QR Expo Go
```

### **5. MERITOS Projeto**
- **Escalável**: 1000+ pacientes sem servidor
- **Nativo**: Android/iOS/Web único código  
- **Offline-first**: Service worker PWA
- **Seguro**: Supabase RLS + senhas temporárias
- **UX Pro**: QR auto-login + chat realtime

**📈 PRONTO para DEFESA!** Apresente `FICHA_TECNICA.md` + rode `npx expo start`.
