# 📖 Guia de Implementação - Sistema de Fila de Secretária

## Para Desenvolvedores

### 1. Arquivos Criados/Modificados

```
✅ src/types/triagem.ts                           (ATUALIZADO)
✅ src/types/appointment.ts                       (ATUALIZADO)
✅ src/services/triagemService.ts                 (ATUALIZADO)
✅ src/services/agendamentoService.ts             (ATUALIZADO)
✅ src/services/secretarioService.ts              (EXPANDIDO)
✅ src/screens/secretario/SecretarioDashboardScreen.tsx  (ATUALIZADO)
✅ src/hooks/useFilasSecretaria.ts                (CRIADO)
✅ src/components/FilasList.tsx                   (CRIADO)
✅ ARQUITETURA_FLUXO_SECRETARIA.md                (CRIADO)
```

### 2. Próximas Etapas Técnicas

#### ⚠️ IMPORTANTE: Migrations no Supabase

Você precisa executar as seguintes alterações no banco de dados Supabase:

```sql
-- 1. Adicionar novo status de triagem
ALTER TYPE triagem_status ADD VALUE 'triagem_pendente_secretaria';

-- 2. Adicionar colunas na tabela triagens
ALTER TABLE triagens ADD COLUMN secretario_id UUID REFERENCES profiles(id);
ALTER TABLE triagens ADD COLUMN motivo_recusa TEXT;

-- 3. Adicionar novo status de agendamento
ALTER TYPE agendamento_status ADD VALUE 'agendamento_pendente_secretaria';
ALTER TYPE agendamento_status ADD VALUE 'atribuido_dentista';

-- 4. Adicionar colunas na tabela agendamentos
ALTER TABLE agendamentos ADD COLUMN secretario_id UUID REFERENCES profiles(id);

-- 5. Criar índices para performance
CREATE INDEX idx_triagens_status ON triagens(status);
CREATE INDEX idx_triagens_secretario ON triagens(secretario_id);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
CREATE INDEX idx_agendamentos_secretario ON agendamentos(secretario_id);
```

#### ✅ Integração no Dashboard (Optional)

Para usar o novo componente `FilasList`, atualize o `SecretarioDashboardScreen`:

```typescript
import FilasList from '../../components/FilasList';
import useFilasSecretaria from '../../hooks/useFilasSecretaria';

export const SecretarioDashboardScreen: React.FC = () => {
  const { filas, carregarFilas } = useFilasSecretaria();

  // Adicione estas abas ao navegador de tabs
  return (
    <>
      {/* ... outras abas ... */}
      
      <Tab.Screen 
        name="FilasSecretaria" 
        options={{ title: '📋 Filas' }}
      >
        {() => (
          <ScrollView>
            <FilasList
              titulo="Triagens Pendentes"
              tipo="triagem"
              dados={filas.triagensNovas}
              onAtribuir={handleAtribuirTriagem}
              onRejeitar={handleRejeitarTriagem}
            />
            
            <FilasList
              titulo="Agendamentos Pendentes"
              tipo="agendamento"
              dados={filas.agendamentosNovos}
              onAtribuir={handleAtribuirAgendamento}
              onRejeitar={handleRejeitarAgendamento}
            />
          </ScrollView>
        )}
      </Tab.Screen>
    </>
  );
};
```

### 3. Testando a Implementação

```typescript
// Teste 1: Criar triagem (paciente)
const { data: triagem } = await criarTriagem({
  paciente_id: 'patient-123',
  sintoma_principal: 'Dor intensa',
  intensidade_dor: 8,
}, [], 'patient-123');

console.assert(triagem.status === 'triagem_pendente_secretaria', 'Status incorreto');

// Teste 2: Atribuir triagem (secretária)
const { success } = await atribuirTriagemAoDentista(
  triagem.id,
  'dentist-456',
  'secretary-789',
  'Caso urgente'
);

console.assert(success === true, 'Falha na atribuição');

// Teste 3: Verificar status atualizado
const { data: triagensAtualizadas } = await buscarTriagensPendentesSecretaria();
console.assert(
  !triagensAtualizadas.find(t => t.id === triagem.id),
  'Triagem ainda na fila'
);
```

---

## Para Secretárias (Usuários Finais)

### 🎯 Seu Novo Fluxo de Trabalho

#### 1. **Triagens Pendentes**
```
Cada dia você verá uma FILA de TRIAGENS esperando sua aprovação

┌─────────────────────────────────────┐
│ 📋 Triagens Pendentes (3 novas)     │
├─────────────────────────────────────┤
│ 👤 João Silva                       │
│   Dor intensa / Dor: 9/10           │
│   "Dor intensificada à mastigação"  │
│   [Rejeitar] [Atribuir a Dentista] │
├─────────────────────────────────────┤
│ 👤 Maria Santos                     │
│   Sangramento na gengiva / 7/10     │
│   [Rejeitar] [Atribuir a Dentista] │
└─────────────────────────────────────┘
```

**O que fazer:**
1. Leia o sintoma principal e a descrição
2. **Aprove:** Clique "Atribuir" para escolher qual dentista atenderá
3. **Rejeite:** Se os dados estiverem incompletos, clique "Rejeitar"

#### 2. **Agendamentos Pendentes**
```
Quando um PACIENTE pede um AGENDAMENTO, vem para você primeiro

┌──────────────────────────────────────┐
│ 📅 Agendamentos Pendentes (2 novos) │
├──────────────────────────────────────┤
│ 👤 Carlos Oliveira                  │
│   Avaliação geral / Urgência: Alta  │
│   Solicitado há 2 horas             │
│ [Rejeitar] [Atribuir + Data/Hora]  │
├──────────────────────────────────────┤
│ 👤 Ana Costa                        │
│   Limpeza / Urgência: Normal        │
│   [Rejeitar] [Atribuir + Data/Hora]│
└──────────────────────────────────────┘
```

**O que fazer:**
1. Veja a urgência (🔴 Urgente, 🟡 Normal, 🟢 Baixa)
2. **Aprove:** Clique "Atribuir" para:
   - Escolher qual dentista
   - Definir data do agendamento
   - Definir hora do agendamento
3. **Rejeite:** Se o paciente não puder ser agendado

### 📊 Indicadores na Tela

```
Você sempre verá esses números:

[Triagens: 5]  [Agendamentos: 3]  [Total: 8]

Entenda:
- 🔴 Vermelho (5 de 5) = Muitas triagens esperando!
- 🟡 Laranja (3 de 3) = Moderado
- 🟢 Verde = Tudo sob controle!
```

### ✅ Seu Checklist Diário

```
☐ 08:00 - Abra o app e veja as filas do dia
☐ 09:00 - Processe todas as triagens (aprove ou rejeite)
☐ 10:00 - Processe todos os agendamentos
☐ 14:00 - Verifique filas novamente
☐ 16:00 - Últimas aprovações do dia
☐ 17:00 - Reporte pendências ao gestor
```

### 🚨 Casos Especiais

#### Triagem Urgente (Dor ≥ 8/10)?
```
➡️ Prioridade MÁXIMA
   1. Rejeite dados incompletos imediatamente
   2. Atribua ao dentista + urgente disponível
   3. Peça para dentista responder em até 1 hora
```

#### Paciente Sem Dados Completos?
```
➡️ REJEITE com motivo:
   - "Telefone incompleto"
   - "Descrição muito vaga"
   - "Imagens não carregadas"
   
   O PACIENTE receberá e poderá reenviar!
```

#### Dentista Sobrecarregado?
```
➡️ Distribua entre outros:
   1. Veja carga de cada dentista
   2. Atribua ao menos ocupado
   3. Equalize a carga de trabalho
```

### 📞 Ajuda Rápida

**"Onde vejo as triagens?"**
→ Painel Principal, aba "Filas"

**"Como rejeitar uma triagem?"**
→ Clique no botão "Rejeitar" e indique o motivo

**"Quantos itens posso processar por dia?"**
→ Não há limite! Processe conforme chegam

**"O paciente vê quando eu aprovo?"**
→ Sim! Ele recebe notificação quando dentista for atribuído

---

## 📋 Checklist de Implementação

Para o **desenvolvedor** implementar completamente:

- [ ] Executar migrations SQL no Supabase
- [ ] Atualizar tipos TypeScript (já feito ✅)
- [ ] Modificar serviços (já feito ✅)
- [ ] Integrar componente FilasList no dashboard
- [ ] Testar fluxo completo de triagem
- [ ] Testar fluxo completo de agendamento
- [ ] Adicionar notificações reais (Firebase, Supabase realtime)
- [ ] Configurar RLS (Row Level Security) no Supabase
- [ ] Documentar para secretárias
- [ ] Treinar secretárias no sistema

---

## 🔔 Notificações (Futuro)

Em breve, as secretárias receberão:

```
📬 Notificação: 3 novas triagens na fila!
📬 Notificação: Agendamento urgente aguardando atribuição
📬 Notificação: Triagem foi rejeitada e reenviada pelo paciente
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique se o banco tem as colunas necessárias
2. Verifique se o status enum foi criado
3. Teste com um paciente de teste primeiro
4. Verifique os logs do Supabase para RLS errors

---

## 🎓 Última Coisa

**Benefício:** Com esse sistema, você centraliza TODA a lógica, evita duplicatas e garante que apenas pacientes com dados completos chegam aos dentistas.

**Resultado:** Menor carga de trabalho dos dentistas + mais pacientes processados = Melhor eficiência! ✨
