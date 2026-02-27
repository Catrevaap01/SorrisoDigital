# Como Criar Admin no Supabase

## Opção 1: Criar Admin via SQL (Recomendado para Produção)

### Passo 1: Acessar SQL Editor
1. Abra seu projeto em [app.supabase.com](https://app.supabase.com)
2. Vá em **SQL Editor** na barra lateral
3. Clique em **"+ New Query"**

### Passo 2: Correr o Script

Execute o script `SUPABASE_SETUP.sql` fornecido. Ele vai:
- Criar as funções e triggers necessários
- Configurar políticas de segurança (RLS)
- Preparar a estrutura para admins

### Passo 3: Criar Conta Admin via Supabase Dashboard

1. Vá em **Authentication** > **Users**
2. Clique em **"Add user"**
3. Preencha:
   - **Email**: `admin@teodonto.com` (ou outro)
   - **Password**: senhaforte123 (será alterada na primeira login)
4. Clique em **"Create user"**

### Passo 4: Associar Perfil Admin no Banco

1. Volte em **SQL Editor**
2. Crie um novo script:

```sql
UPDATE public.profiles
SET tipo = 'admin'
WHERE email = 'admin@teodonto.com';
```

3. Execute o script

---

## Opção 2: Criar Admin via Código (CLI/API)

### (a) Usando o script Node fornecido

Para tornar a criação de um administrador mais simples e reproduzível, incluímos um
pequeno script Node em `scripts/create-admin.js`. Ele realiza três etapas:

1. Cria ou recupera o usuário no Supabase Auth (usando a **service role key**).
2. Insere/atualiza um registro na tabela `profiles` com `tipo = 'admin'`.
3. Exibe as credenciais geradas e orientações.

> ⚠️ **IMPORTANTE:** o script exige a variável de ambiente `SUPABASE_SERVICE_KEY`.
> Coloque a chave no `.env` local ou exporte antes de executar. A chave anônima **não**
> funciona para essa operação, pois não tem privilégios para criar usuários.

Uso:
```bash
# definindo variáveis (no Windows PowerShell por exemplo):
$Env:SUPABASE_SERVICE_KEY="your-service-role-key-here"
$Env:SUPABASE_URL="https://xyzcompany.supabase.co"

# executar
node scripts/create-admin.js admin@teodonto.com "Administrador" "SenhaForte123!"
```

O script é inteligente o suficiente para:

- Detectar se o email já existe e recuperar o usuário.
- Inserir ou atualizar o perfil (`upsert`) evitando erros de chave duplicada.
- Lidar com esquemas antigos que não têm a coluna `senha_alterada`.

Se tudo ocorrer bem, ele exibirá um resumo com o ID do usuário e instruções de login.

### (b) Usando a função de serviço (dentistaService)

Em `src/services/dentistaService.ts`, já existe a função para criar dentista. Para criar admin, use assim:

```typescript
import { criarDentista } from './dentistaService';

// Criar um admin
const resultado = await criarDentista(
  'admin@teodonto.com',
  'senhaTemporaria123!', // será alterada na primeira login
  'Admin TeOdonto',
  'Administrador',
  'ADM001', // CRM/CRO
  '+244923456789',
  'Luanda'
);

if (resultado.success) {
  // Atualizar tipo para 'admin'
  const { error } = await supabase
    .from('profiles')
    .update({ tipo: 'admin' })
    .eq('email', 'admin@teodonto.com');
  
  if (!error) {
    console.log('Admin criado com sucesso!');
  }
}
```
---

## Opção 3: Criar Admin Manual (Admin Dashboard da App)

Se você tiver acesso ao AdminDashboard como usuário existente:

1. Abra a tela AdminDashboard
2. Clique em **"Novo Dentista"**
3. Preencha os dados
4. **Antes de salvar**, abra o DevTools do seu console:

```typescript
// No console do React Native/Expo:
const { supabase } = require('./src/config/supabase');

await supabase
  .from('profiles')
  .update({ tipo: 'admin' })
  .eq('email', 'novo-admin@teodonto.com');
```

---

## Verificar se Admin Foi Criado

### Via SQL
```sql
SELECT id, email, tipo, nome FROM public.profiles WHERE tipo = 'admin';
```

### Via App
1. Faça login com a conta admin
2. Deve aparecer a tela **AdminDashboard** automaticamente
3. Admin **não é forçado** a alterar a senha (pode fazer login direto)

---

## 📝 Comportamento de Senha: Dentista vs Admin

| Você | Primeira Login | Comportamento |
|------|---|---|
| **Dentista** | ✋ Força alterar senha | Vê tela `ChangePasswordScreen` → Obrigado a alterar → Depois acessa `DashboardScreen` |
| **Admin** | ✅ Acesso imediato | Acessa `AdminDashboard` direto → Pode alterar senha quando quiser (opcional) |
| **Paciente** | ✅ Acesso imediato | Acessa `HomeScreen` direto |

- **Dentistas**: `senha_alterada = false` → **força** tela de alterar senha
- **Admin**: `senha_alterada = true` → acesso direto (sem obrigação)

---

## Estrutura da Tabela Profiles (Necessária)

Certifique-se que sua tabela `profiles` tem essas colunas:

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome TEXT,
  tipo TEXT DEFAULT 'paciente', -- 'paciente', 'dentista', 'admin'
  telefone TEXT,
  provincia TEXT,
  
  -- Para Dentistas
  crm TEXT,
  cro TEXT,
  especialidade TEXT,
  
  -- Controle de Acesso
  senha_alterada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

---

## Troubleshooting

### "Não consigo ver AdminDashboard"
- Verifique se `tipo = 'admin'` na tabela profiles
- Faça logout e login novamente
- Limpe cache da app (Expo: `npx expo start --clear`)

### "Erro ao criar usuário"
- Verifique se o email já existe
- Confirme que a senha atende requisitos (8+ chars, número, símbolo)

### "RLS bloqueando acesso"
- Verifique as políticas de RLS em `Authentication` > `Policies`
- Certifique-se que o usuário tem as permissões corretas

---

## Fluxo de Login (Navegação Automática)

### Admin
```
1. Admin faz login com email/senha
2. Sistema verifica: tipo === 'admin' && senha_alterada === true?
3. Sim → AdminDashboard ✅
```

### Dentista
```
1. Dentista faz login com email/senha
2. Sistema verifica: tipo === 'dentista' && senha_alterada === false?
3. Sim → Força tela "ChangePasswordScreen" (obrigatório)
4. Após alterar → DashboardScreen dos Dentista ✅
```

### Paciente
```
1. Paciente faz login com email/senha
2. Sistema verifica: tipo === 'paciente'?
3. Sim → HomeScreen ✅
```

---

## Segurança

✅ **O que foi implementado:**
- Senhas temporárias geradas automaticamente
- Força de primeiro login para alterar senha
- RLS no banco para controlar visibilidade
- Validação de tipo em cada navegação

⚠️ **O que você DEVE fazer:**
- Usar HTTPS em produção
- Ativar 2FA no Supabase
- Revisar RLS policies regularmente
- Não compartilhar tokens de admin
