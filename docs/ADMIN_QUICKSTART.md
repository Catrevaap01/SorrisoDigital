# Criar Admin - Guia Rápido

## 3 Maneiras de Criar um Admin

---

## 1️⃣ **MAIS RÁPIDO: Via Script Node.js** ⚡

Se você tem Node.js instalado:

```bash
cd E:\SorrisoDigital\TeOdontoAngola
node scripts/create-admin.js admin@teodonto.com "Administrador" "SenhaForte123!"
```

**Saída esperada:**
```
✅ ADMIN CRIADO COM SUCESSO!

Detalhes da Conta:
Email: admin@teodonto.com
Nome: Administrador
Senha: SenhaForte123!
User ID: xxx-xxx-xxx
Tipo: admin
Precisa alterar senha na 1ª login: SIM
```

---

## 2️⃣ **VIA DASHBOARD SUPABASE** 🌐

### Passo-a-Passo:

1. **Acesse Supabase**
   - Vá em [app.supabase.com](https://app.supabase.com)
   - Select seu projeto TeOdonto Angola

2. **Crie o Usuário**
   - **Authentication** → **Users**
   - Clique **"Add user"**
   - Email: `admin@teodonto.com`
   - Password: `SenhaForte123!`
   - Click **"Create user"**

3. **Configure como Admin**
   - Vá em **SQL Editor** > **New Query**
   - Cole:
   ```sql
   UPDATE public.profiles
   SET tipo = 'admin'
   WHERE email = 'admin@teodonto.com';
   ```
   - Click **"Run"**

4. ✅ Pronto!

---

## 3️⃣ **VIA CÓDIGO (React Native)**

Crie um arquivo temporário em `src/dev/create-admin.ts`:

```typescript
import { supabase } from '../config/supabase';
import { criarDentista } from '../services/dentistaService';

export async function setupTestAdmin() {
  try {
    // Criar usuário
    const result = await criarDentista(
      'admin@teodonto.com',
      'SenhaForte123!',
      'Administrador',
      'Admin TeOdonto',
      'ADM001',
      '+244923456789',
      'Luanda'
    );

    if (result.success) {
      // Atualizar para admin
      await supabase
        .from('profiles')
        .update({ tipo: 'admin' })
        .eq('email', 'admin@teodonto.com');

      console.log('✅ Admin criado!');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}
```

Depois importe e chame uma vez no seu dev environment.

---

## ✅ Verificar se Admin Funciona

### No Supabase Dashboard:
1. **SQL Editor** > **New Query**
2. ```sql
   SELECT email, nome, tipo FROM profiles WHERE tipo = 'admin';
   ```
3. Veja se aparece sua conta admin

### Na Aplicação:
1. Faça login com email/senha do admin
2. Deve ir direto para a tela **"Alterar Senha"** (primeira login obrigatória)
3. Altere a senha e confirme
4. Pronto! Verá o **AdminDashboard** com opções para gerenciar dentistas e relatórios

---

## Checklist Final

- [ ] Admin criado no Supabase
- [ ] Email confirmado
- [ ] Tipo = 'admin' na tabela profiles
- [ ] Consegue fazer login
- [ ] Consegue alterar senha na primeira login
- [ ] Vê a tela AdminDashboard
- [ ] Consegue criar dentistas
- [ ] Consegue ver relatórios

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| "Erro ao criar usuário" | Verifique email (deve ser válido) e senha (8+ chars com número/símbolo) |
| "Não vejo AdminDashboard" | Faça logout e login novamente; limpe cache (Expo: `npx expo start --clear`) |
| "Bloqueado por RLS" | Execute o script SQL `SUPABASE_SETUP.sql` para configurar políticas |
| "Email já existe" | Use outro email ou delete o usuário antes de criar novamente |

---

## 🔐 Segurança

✅ Implementado:
- Senhas temporárias
- Força alterar senha na primeira login
- RLS no banco de dados
- Validação de tipo em cada ação

⚠️ Para Produção:
- Usar HTTPS
- Ativar 2FA no Supabase
- Revisar políticas RLS
- Não compartilhar credenciais via email
