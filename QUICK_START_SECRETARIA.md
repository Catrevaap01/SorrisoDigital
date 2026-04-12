# ⚡ Quick Start - Implementar Sistema de Fila de Secretária

## 🎯 O que foi feito:

✅ **Tipos** - Novos status de triagem e agendamento  
✅ **Serviços** - 6 novas funções para secretária  
✅ **Dashboard** - Atualizado para buscar filas  
✅ **Componentes** - FilasList reutilizável  
✅ **Hook** - useFilasSecretaria para gerenciar estado  
✅ **Documentação** - 3 MDfiles explicando tudo  

---

## 🔥 O que você precisa fazer agora:

### PASSO 1: Banco de Dados (5 min)

Execute isto no console Supabase (SQL Editor):

```sql
-- 1. Adicionar status de triagem
ALTER TYPE triagem_status ADD VALUE 'triagem_pendente_secretaria';

-- 2. Adicionar colunas em triagens
ALTER TABLE public.triagens ADD COLUMN secretario_id uuid references public.profiles(id);
ALTER TABLE public.triagens ADD COLUMN motivo_recusa text;

-- 3. Adicionar status de agendamento
ALTER TYPE agendamento_status ADD VALUE 'agendamento_pendente_secretaria';
ALTER TYPE agendamento_status ADD VALUE 'atribuido_dentista';

-- 4. Adicionar colunas em agendamentos
ALTER TABLE public.agendamentos ADD COLUMN secretario_id uuid references public.profiles(id);

-- 5. Índices para performance
CREATE INDEX idx_triagens_status ON triagens(status);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
```

### PASSO 2: Integración no Dashboard (10 min)

Abra: `src/screens/secretario/SecretarioDashboardScreen.tsx`

Adicione isto ao final do renderizar (antes do </Tab.Navigator>):

```typescript
import FilasList from '../../components/FilasList';

// Inside Tab.Navigator:
<Tab.Screen
  name="FilasSecretaria"
  options={{
    title: '📋 Filas',
    tabBarIcon: ({ focused, color, size }) => (
      <Ionicons
        name={focused ? 'list' : 'list-outline'}
        size={size}
        color={color}
      />
    ),
  }}
>
  {() => (
    <ScrollView>
      <View style={{ padding: 16, gap: 16 }}>
        <FilasList
          titulo="Triagens Pendentes"
          tipo="triagem"
          dados={triagensNovasFila}
          loading={loading}
          onAtribuir={(item) =>
            (navigation as any).navigate('AtribuirDentista', {
              triagemId: item.id,
            })
          }
          onRejeitar={(item) =>
            handleRejeitarTriagem(item.id)
          }
        />

        <FilasList
          titulo="Agendamentos Pendentes"
          tipo="agendamento"
          dados={agendamentosNovasFila}
          loading={loading}
          onAtribuir={(item) =>
            (navigation as any).navigate('AtribuirAgendamento', {
              agendamentoId: item.id,
            })
          }
          onRejeitar={(item) =>
            handleRejeitarAgendamento(item.id)
          }
        />
      </View>
    </ScrollView>
  )}
</Tab.Screen>
```

### PASSO 3: Implementar Handlers (5 min)

Ainda no `SecretarioDashboardScreen.tsx`, adicione:

```typescript
import {
  atribuirTriagemAoDentista,
  recusarTriagem,
  atribuirAgendamentoAoDentista,
  rejeitarAgendamento,
} from '../../services/secretarioService';
import Toast from 'react-native-toast-message';

// Dentro do componente:
const handleRejeitarTriagem = async (triagemId: string) => {
  const motivo = await promptUser('Motivo da rejeição:'); // Implemente conforme seu UI
  if (!motivo) return;

  const { success, error } = await recusarTriagem(
    triagemId,
    profile?.id || '',
    motivo
  );

  if (success) {
    Toast.show({ type: 'success', text1: 'Triagem rejeitada' });
    await carregar(); // Recarrega filas
  } else {
    Toast.show({ type: 'error', text1: error || 'Erro ao rejeitar' });
  }
};

const handleRejeitarAgendamento = async (agendamentoId: string) => {
  const motivo = await promptUser('Motivo da rejeição:');
  if (!motivo) return;

  const { success, error } = await rejeitarAgendamento(
    agendamentoId,
    profile?.id || '',
    motivo
  );

  if (success) {
    Toast.show({ type: 'success', text1: 'Agendamento rejeitado' });
    await carregar();
  } else {
    Toast.show({ type: 'error', text1: error || 'Erro ao rejeitar' });
  }
};
```

### PASSO 4: Testar (5 min)

1. Crie uma conta de paciente
2. Crie uma triagem (status deve ser `triagem_pendente_secretaria`)
3. Faça login como secretária
4. Veja a fila na aba "Filas"
5. Clique "Atribuir" e escolha um dentista
6. Verifique se triagem mudou de status

### PASSO 5: Deploy (1 min)

```bash
# Commit as mudanças
git add .
git commit -m "feat: sistema de fila de secretária"
git push origin main

# Expo
eas build --platform all --auto-submit
# ou
expo deploy
```

---

## ⚠️ Se algo não funcionar:

### Erro: "Type 'triagem_pendente_secretaria' não existe"
**Solução:** Você não executou o SQL do PASSO 1. Faça-o agora!

### Erro: "Column 'secretario_id' não existe"
**Solução:** Você não executou o SQL do PASSO 1. Faça-o agora!

### Triagens ainda vão direto para 'pendente'
**Solução:** Verifique se a mudança em `criarTriagem()` foi aplicada.

### Dashboard não mostra filas
**Solução:** Verifique se adicionou a aba no PASSO 2 corretamente.

---

## 📱 Teste Manual (Secenário Completo)

1. **Paciente cria triagem:**
   ```
   Nome: Teste Silva
   Sintoma: Dor intensa
   Dor: 9/10
   ```

2. **Verificar status no banco:**
   ```sql
   SELECT id, status, paciente_id FROM triagens WHERE paciente_id = 'xxx' LIMIT 1;
   -- Resultado: status = 'triagem_pendente_secretaria' ✅
   ```

3. **Secretária aprova:**
   - Login como secretária
   - Vai para aba "Filas"
   - Vê a triagem
   - Clica "Atribuir"
   - Escolhe dentista
   - Confirma

4. **Verificar no banco novamente:**
   ```sql
   SELECT id, status, dentista_id, secretario_id FROM triagens WHERE paciente_id = 'xxx' LIMIT 1;
   -- Resultado: status = 'pendente', dentista_id = 'yyy', secretario_id = 'zzz' ✅
   ```

---

## 🎓 Documentação Adicional

- **Arquitetura completa:** `ARQUITETURA_FLUXO_SECRETARIA.md`
- **Guia para secretárias:** `GUIA_IMPLEMENTACAO_SECRETARIA.md`
- **Sumário de mudanças:** `SUMARIO_ALTERACOES_SECRETARIA.md`

---

## ✅ Checklist Final

- [ ] SQL executado no Supabase
- [ ] Dashboard atualizado com nova aba
- [ ] Handlers implementados
- [ ] Testado fluxo de triagem
- [ ] Testado fluxo de agendamento
- [ ] Commit feito
- [ ] Deploy realizado
- [ ] Secretárias treinadas

---

## 🚀 Resultado Esperado

```
Paciente cria triagem
    ↓
Status: triagem_pendente_secretaria ✨
    ↓
Secretária vê na aba "Filas"
    ↓
Secretária clica "Atribuir"
    ↓
Triagem vai para dentista
    ↓
Status: pendente ✨
    ↓
Dentista responde
```

**Pronto!** 🎉 Seu sistema de fila está funcionando!

---

## 💬 Perguntas Frequentes

**P: Quanto tempo leva?**  
A: ~25 minutos se tudo correr bem

**P: Quebra alguma funcionalidade existente?**  
A: Não. Muda apenas o fluxo inicial.

**P: Posso fazer rollback?**  
A: Sim, basta reverter as mudanças do banco e os arquivos.

**P: Como notificar secretárias em tempo real?**  
A: Configure Supabase Realtime + webhooks (próxima fase)

---

## 📞 Suporte

Se preso, verifique:
1. Arquivo do PASSO 1 - SQL correto?
2. Arquivo do PASSO 2 - Componente importado?
3. Console do navegador - erros TypeScript?
4. Logs do Supabase - RLS bloqueia?

Bom trabalho! 🚀
