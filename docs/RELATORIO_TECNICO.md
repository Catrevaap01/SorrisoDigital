# Relatório Técnico - TeOdonto Angola

**Versão:** 1.0.0  
**Data:** Fevereiro 2026  
**Projeto:** Sistema de Gestão de Consultas Odontológicas  

---

## 1. Visão Geral do Projeto

### 1.1 Descrição

O **TeOdonto Angola** é uma aplicação móvel multiplataforma desenvolvida em React Native (Expo) com backend no Supabase. O sistema foi concebido para gerir consultas odontológicas em Angola, conectando pacientes a dentistas através de um fluxo completo de triagem, agendamento e acompanhamento de casos clínicos.

### 1.2 Objetivos

- **Principal:**Facilitar o acesso a cuidados dentários em Angola através de uma plataforma digital
- **Secundários:**Automatizar agendamentos, triagens e relatórios clínicos

### 1.3 Público-Alvo

- **Pacientes:**Cidadãos angolanos que necessitam de atendimento odontológico
- **Dentistas:**Profissionais de medicina dentária que desejam gerir os seus pacientes
- **Administradores:**Equipa de gestão do sistema

---

## 2. Arquitetura do Sistema

### 2.1 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Mobile)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Paciente  │  │   Dentista  │  │   Admin     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase (Backend-as-a-Service)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  PostgreSQL │  │   Auth      │  │  Realtime   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │    RLS      │  │   Storage   │  │    Edge     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Diretórios

```
teodontoangola/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── ui/             # Componentes base (Button, Input, Loading)
│   │   ├── Card.tsx        # Card genérico
│   │   └── ProfileEditModal.tsx
│   │
│   ├── config/
│   │   └── supabase.ts     # Configuração do cliente Supabase
│   │
│   ├── contexts/           # Contextos React (Estado global)
│   │   ├── AuthContext.tsx # Autenticação
│   │   ├── DentistContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── hooks/              # Custom Hooks
│   │   ├── useAgendamentos.ts
│   │   ├── useTriagens.ts
│   │   ├── useDentistas.ts
│   │   └── useRealTimeMessages.ts
│   │
│   ├── navigation/
│   │   ├── AppNavigator.tsx # Navegação principal
│   │   ├── AdminNavigator.tsx
│   │   └── types.ts        # Tipos TypeScript para navegação
│   │
│   ├── screens/
│   │   ├── auth/           # Ecrãs de autenticação
│   │   ├── paciente/       # Ecrãs do paciente
│   │   ├── dentista/       # Ecrãs do dentista
│   │   ├── admin/          # Ecrãs de administração
│   │   └── shared/         # Ecrãs partilhados
│   │
│   ├── services/           # Camada de serviços
│   │   ├── authService.ts
│   │   ├── agendamentoService.ts
│   │   ├── relatorioService.ts
│   │   ├── triagemService.ts
│   │   ├── messagesService.ts
│   │   └── pdfReportService.ts
│   │
│   ├── styles/
│   │   ├── theme.ts
│   │   └── themeColors.ts
│   │
│   └── utils/              # Utilitários
│       ├── constants.ts
│       ├── helpers.ts
│       ├── validators.ts
│       ├── errorHandler.ts
│       └── logger.ts
│
├── assets/                 # Recursos estáticos
├── docs/                   # Documentação
├── scripts/                # Scripts de gestão
└── __tests__/              # Testes unitários
```

---

## 3. Stack Tecnológico

### 3.1 Frontend

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| Expo | 54.0.0 | Framework React Native |
| React Native | 0.81.5 | Biblioteca de UI mobile |
| React | 19.1.0 | Biblioteca JavaScript UI |
| TypeScript | 5.9.2 | Superset tipado de JavaScript |
| React Navigation | 7.0.0 | Biblioteca de navegação |

**Dependências Principais:**

- `@supabase/supabase-js` (2.97.0) - Cliente Supabase
- `@react-navigation/bottom-tabs` - Navegação por tabs
- `@react-navigation/native-stack` - Navegação stack nativa
- `date-fns` (2.30.0) - Manipulação de datas
- `expo-secure-store` (15.0.8) - Armazenamento seguro
- `expo-print` / `expo-sharing` - Geração e partilha de PDF
- `react-native-toast-message` - Notificações toast
- `@expo/vector-icons` - Ícones

### 3.2 Backend (Supabase)

| Serviço | Descrição |
|---------|-----------|
| PostgreSQL | Base de dados relacional |
| Supabase Auth | Autenticação de utilizadores |
| Row Level Security (RLS) | Segurança ao nível das linhas |
| Realtime | Atualizações em tempo real |
| Edge Functions | Funções serverless |

### 3.3 Ambiente de Desenvolvimento

- **Node.js:** v18+
- **npm:** v9+
- **Sistema Operativo:** Windows 10/11, macOS, Linux
- **Editor Recomendado:** VSCode

---

## 4. Modelos de Dados

### 4.1 Tabelas Principais

#### `profiles`

Armazena informações dos utilizadores (pacientes, dentistas, admins).

```sql
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  nome TEXT,
  telefone TEXT,
  provincia TEXT,
  tipo TEXT CHECK (tipo IN ('paciente', 'dentista', 'admin')),
  especialidade TEXT,
  crm TEXT,
  senha_alterada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `agendamentos`

Registo de consultas agendadas.

```sql
CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id),
  dentista_id UUID REFERENCES profiles(id),
  data_agendamento TIMESTAMPTZ NOT NULL,
  tipo TEXT,
  observacoes TEXT,
  prioridade TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'agendado', 'confirmado', 'realizado', 'cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `triagens`

Avaliações clínicas iniciais submetidas por pacientes.

```sql
CREATE TABLE public.triagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id),
  dentista_id UUID REFERENCES profiles(id),
  sintomas TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'respondido', 'completo')),
  resposta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `messages`

Mensagens entre utilizadores.

```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Esquema de Relacionamentos

```
┌──────────────┐       ┌──────────────┐
│   profiles  │       │   profiles   │
│  (paciente) │◄──────│  (dentista)  │
└──────┬───────┘       └──────┬───────┘
       │                      │
       │            ┌────────┴────────┐
       │            │   agendamentos │
       │            │    triagens     │
       └───────────►│    messages    │
                    └────────────────┘
```

---

## 5. Funcionalidades Principais

### 5.1 Autenticação e Autorização

- **Registo:**Criação de conta com tipo (paciente/dentista)
- **Login:**Autenticação por email/password
- **Recuperação de Senha:**Via email
- **Gestão de Perfis:**Edição de informações pessoais
- **Mudança de Senha Obrigatória:**Force password change no primeiro login

### 5.2 Módulo Paciente

| Funcionalidade | Descrição |
|----------------|-----------|
| Triagem | Submissão de avaliação de sintomas |
| Agendamento | Marcação de consultas |
| Histórico | Visualização de consultas passadas |
| Mensagens | Comunicação com dentistas |
| Educação | Conteúdo educacional sobre saúde oral |

### 5.3 Módulo Dentista

| Funcionalidade | Descrição |
|----------------|-----------|
| Dashboard | Visão geral das atividades |
| Agenda | Gestão de consultas do dia |
| Triagens | Resposta a avaliações de pacientes |
| Relatórios | Geração de relatórios (PDF/CSV) |
| Mensagens | Comunicação com pacientes |

### 5.4 Módulo Admin

| Funcionalidade | Descrição |
|----------------|-----------|
| Dashboard | Estatísticas gerais do sistema |
| Relatórios | Relatórios consolidados |
| Gestão | Visualização de todos os utilizadores |

### 5.5 Sistema de Relatórios

O sistema oferece múltiplos formatos de exportação:

- **PDF:**Relatórios formatados para impressão
- **CSV:**Dados tabulares para análise
- **JSON:**Dados estruturados para integração
- **HTML:**Visualização em navegador

#### Relatório do Dentista

```typescript
interface RelatorioDentista {
  dentista: DentistaProfile;
  totalTriagens: number;
  triagensRespondidas: number;
  triagensPendentes: number;
  percentualResposta: number;
  dataUltimaAtividade: string | null;
}
```

#### Relatório Geral (Admin)

```typescript
interface RelatorioGeral {
  totalDentistas: number;
  totalPacientes: number;
  dentistasAtivos: number;
  totalTriagens: number;
  totalConsultas: number;
  totalMensagens: number;
  triagensRespondidas: number;
  percentualResposta: number;
  dentistas: RelatorioDentista[];
  dataGeracao: string;
}
```

---

## 6. Medidas de Segurança

### 6.1 Autenticação

- Credenciais armazenadas no Supabase Auth
- Tokens JWT para sessão
- Expiração de tokens configurável
- force_password_change para primeiros logins

### 6.2 Row Level Security (RLS)

Políticas de segurança implementadas:

```sql
-- Exemplo: Pacientes apenas veem os seus próprios dados
CREATE POLICY "Pacientes veem próprio perfil"
ON profiles FOR SELECT
USING (auth.uid() = id OR tipo = 'admin');
```

### 6.3 Armazenamento Seguro

- `expo-secure-store` para dados sensíveis no dispositivo
- Variáveis de ambiente para credenciais Supabase

### 6.4 Validação de Entrada

- Validadores centralizados em `src/utils/validators.ts`
- Validação tanto no frontend quanto no backend

---

## 7. Padrões de Código

### 7.1 Princípios Aplicados

- **DRY** (Don't Repeat Yourself) - Reutilização de código
- **KISS** (Keep It Simple, Stupid) - Simplicidade
- **SOLID** - Princípios de design orientado a objetos
- **Clean Code** - Código legível e manutenível

### 7.2 Estrutura de Componentes

```tsx
// Componente funcional com TypeScript
const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks
  const [state, setState] = useState<Type>(initialValue);

  // Efeitos
  useEffect(() => {
    // Lógica de efeito
  }, [dependencies]);

  // Render
  return (
    <View>
      {/* JSX */}
    </View>
  );
};
```

### 7.3 Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Ficheiros | kebab-case | `dentista-relatorio-screen.tsx` |
| Componentes | PascalCase | `DentistaRelatorioScreen` |
| Funções | camelCase | `buscarAgendaDentista` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_LENGTH` |
| Interfaces | PascalCase | `Agendamento` |

---

## 8. API e Integrações

### 8.1 Cliente Supabase

```typescript
import { supabase } from './config/supabase';

// Exemplo de query
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('tipo', 'dentista');
```

### 8.2 Funções RPC

O sistema utiliza Stored Procedures para operações complexas:

- `admin_report_stats` - Estatísticas do relatório admin
- `cancelar_agendamento_dentista` - Cancelamento de agendamento

### 8.3 Realtime

```typescript
// Subscrição em tempo real
const channel = supabase
  .channel('messages')
  .on('postgres_changes', { event: 'INSERT', table: 'messages' }, payload => {
    console.log('Nova mensagem:', payload.new);
  })
  .subscribe();
```

---

## 9. Componentes Reutilizáveis

### 9.1 Componentes UI Base

| Componente | Descrição | Props |
|------------|-----------|-------|
| `<Button>` | Botão com variantes | variant, onPress, loading, disabled |
| `<Input>` | Campo de entrada | value, onChange, label, error, icon |
| `<Loading>` | Indicador de carregamento | size, color |
| `<Card>` | Container estilizado | style, children |

### 9.2 Exemplos de Uso

```tsx
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Loading } from './components/ui/Loading';

// Button
<Button
  variant="primary"
  onPress={() => handleSubmit()}
  loading={isLoading}
>
  Guardar
</Button>

// Input
<Input
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={errors.email}
  keyboardType="email-address"
/>
```

---

## 10. Custom Hooks

### 10.1 useAgendamentos

Gestão de agendamentos do dentista.

```typescript
const {
  agendamentos,
  loading,
  error,
  atualizarStatus,
  refresh
} = useAgendamentos(dentistaId);
```

### 10.2 useTriagens

Gestão de triagens pacientes.

```typescript
const {
  triagens,
  loading,
  responderTriagem,
  refresh
} = useTriagens();
```

### 10.3 useDentistas

Busca e filtra dentistas.

```typescript
const {
  dentistas,
  loading,
  buscarPorEspecialidade
} = useDentistas();
```

---

## 11. Configuração e Instalação

### 11.1 Pré-requisitos

```bash
# Node.js >= 18
node --version

# npm >= 9
npm --version

# Expo CLI
npm install -g expo
```

### 11.2 Instalação

```bash
# Clonar repositório
git clone <repo-url>
cd TeOdontoAngola

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com as credenciais Supabase

# Iniciar desenvolvimento
npm start
```

### 11.3 Configuração Supabase

1. Criar projeto em [supabase.com](https://supabase.com)
2. Executar scripts de migração em `docs/`
3. Configurar RLS policies
4. Atualizar credenciais em `app.json`

---

## 12. Testes e Qualidade

### 12.1 Testes Unitários

O projeto inclui testes com Jest:

```bash
# Executar testes
npm test

# Executar com coverage
npm test -- --coverage
```

### 12.2 Validação de Tipos

```bash
# Verificação TypeScript
npm run typecheck
```

---

## 13. Melhorias Implementadas

### 13.1 Segurança

- ✅ Remoção de credenciais hardcoded
- ✅ Variáveis de ambiente
- ✅ Validação centralizada
- ✅ Error handling estruturado

### 13.2 Arquitetura

- ✅ Services layer
- ✅ Custom hooks
- ✅ Componentes reutilizáveis
- ✅ Logger centralizado

### 13.3 Documentação

- ✅ Guias de implementação
- ✅ Exemplos de uso
- ✅ Checklist de desenvolvimento

---

## 14. Limitações e Trabalho Futuro

### 14.1 Limitações Atuais

- Supabase apenas (sem opção offline-first)
- Exportação PDF dependente de expo-print
- Sem testes de integração E2E

### 14.2 Funcionalidades Planeadas

- App para iOS
- Notificações push avançadas
- Videochamada para consultas
- Histórico médico completo
- Prescrições eletrónicas

---

## 15. Anexo: Estrutura de Navegação

```
RootStack
├── AuthStack
│   ├── Login
│   ├── Register
│   ├── ForgotPassword
│   └── ChangePassword
│
├── PacienteStack
│   └── PacienteTabs
│       ├── Início
│       ├── Triagem
│       ├── Educação
│       ├── Histórico
│       ├── Mensagens
│       └── Perfil
│   └── Stack Screens
│       ├── Agendamento
│       └── ChooseDentista
│
├── DentistaStack
│   └── DentistaTabs
│       ├── Dashboard
│       ├── Agenda
│       ├── Relatorio
│       ├── Mensagens
│       └── Perfil
│   └── Stack Screens
│       ├── CasoDetalhe
│       └── PacienteHistorico
│
└── AdminNavigator
    ├── AdminDashboard
    ├── AdminReports
    └── AdminProfile
```

---

## 16. Contactos e Suporte

Para dúvidas ou contribuições:

- **Email:**suporte@teodontoangola.ao
- **Documentação:**Ver pasta `/docs`
- **Scripts SQL:**Ver pasta `/docs/*.sql`

---

*Documento gerado automaticamente em Fevereiro de 2026*

