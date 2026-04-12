# ⚡ REFERÊNCIA RÁPIDA - SISTEMA DE FILA DE SECRETÁRIA

## 🎯 O QUE MUDOU?

### TRIAGEM
```
ANTES: Paciente → Dentista
DEPOIS: Paciente → Secretária → Dentista ✨
```

### AGENDAMENTO
```
ANTES: Paciente define tudo
DEPOIS: Paciente solicita → Secretária define data/hora → Dentista confirma ✨
```

---

## 📝 NOVOS STATUS

### Triagem
```typescript
'triagem_pendente_secretaria'  // ✨ NOVO - aguardando secretária
'pendente'                      // Secretária aprovou, dentista vê
'em_triagem'                    // Dentista está respondendo
'respondida'                    // Dentista respondeu
'recusada'                      // Secretária rejeitou
'cancelada'                     // Paciente cancelou
```

### Agendamento
```typescript
'agendamento_pendente_secretaria'  // ✨ NOVO - aguardando secretária
'atribuido_dentista'               // ✨ NOVO - secretária atribuiu
'confirmado_dentista'              // Dentista confirmou
'realizado'                        // Consulta realizada
'cancelado'                        // Foi cancelado
```

---

## 🔧 CÓDIGO IMPORTANTE

### Criar Triagem (Paciente)
```typescript
const { data, error } = await criarTriagem({
  paciente_id: 'user-123',
  sintoma_principal: 'Dor na gengiva',
  descricao: 'Sangra ao escovar',
  intensidade_dor: 6,
}, imageUris, 'user-123');

// Status automaticamente: 'triagem_pendente_secretaria' ✨
console.log(data.status); // 'triagem_pendente_secretaria'
```

### Buscar Filas (Secretária)
```typescript
// Triagens esperando atribuição
const { data: triagens } = await buscarTriagensPendentesSecretaria();

// Agendamentos esperando atribuição
const { data: agendamentos } = await buscarAgendamentosPendentesSecretaria();
```

### Atribuir Triagem (Secretária)
```typescript
const { success, error } = await atribuirTriagemAoDentista(
  triagemId,           // ID da triagem
  dentistaId,          // ID do dentista escolhido
  secretarioId,        // ID da secretária
  'Caso de urgência'   // Observação opcional
);

// Status muda para: 'pendente' ✨
```

### Rejeitar Triagem (Secretária)
```typescript
const { success, error } = await recusarTriagem(
  triagemId,
  secretarioId,
  'Descrição insuficiente'  // Motivo
);

// Status muda para: 'recusada' ✨
```

### Atribuir Agendamento (Secretária)
```typescript
const { success, error } = await atribuirAgendamentoAoDentista(
  agendamentoId,           // ID do agendamento
  dentistaId,              // Qual dentista
  secretarioId,            // Qual secretária
  '2026-04-15',            // Data (YYYY-MM-DD)
  '14:30',                 // Hora (HH:mm)
  'Preferência: tarde'     // Obs
);

// Status muda para: 'atribuido_dentista' ✨
```

### Rejeitar Agendamento (Secretária)
```typescript
const { success, error } = await rejeitarAgendamento(
  agendamentoId,
  secretarioId,
  'Dentista indisponível'  // Motivo
);

// Status muda para: 'cancelado' ✨
```

---

## 📊 COMPONENTES

### FilasList
```typescript
<FilasList
  titulo="Triagens Pendentes"
  tipo="triagem"
  dados={triagens}
  loading={isLoading}
  onAtribuir={(item) => handleAtribuir(item)}
  onRejeitar={(item) => handleRejeitar(item)}
/>
```

### useFilasSecretaria Hook
```typescript
const { 
  filas,                    // { triagensNovas, agendamentosNovos, contadores }
  carregarFilas,            // () => Promise<void>
  iniciarAutoRevalidate,    // () => void
  pararAutoRevalidate       // () => void
} = useFilasSecretaria();
```

---

## 🗄️ SQL (Copiar/Colar)

```sql
-- Adicionar novo status de triagem
ALTER TYPE triagem_status ADD VALUE 'triagem_pendente_secretaria';

-- Expandir tabela triagens
ALTER TABLE public.triagens 
  ADD COLUMN secretario_id uuid references public.profiles(id);
ALTER TABLE public.triagens 
  ADD COLUMN motivo_recusa text;

-- Adicionar novos status de agendamento
ALTER TYPE agendamento_status ADD VALUE 'agendamento_pendente_secretaria';
ALTER TYPE agendamento_status ADD VALUE 'atribuido_dentista';

-- Expandir tabela agendamentos
ALTER TABLE public.agendamentos 
  ADD COLUMN secretario_id uuid references public.profiles(id);

-- Índices para performance
CREATE INDEX idx_triagens_status ON triagens(status);
CREATE INDEX idx_agendamentos_status ON agendamentos(status);
```

---

## 📋 CHECKLIST DE INTEGRAÇÃO

- [ ] Executar SQL acima no Supabase
- [ ] Importar `FilasList` no dashboard
- [ ] Adicionar aba "Filas" no Tab.Navigator
- [ ] Implementar handlers de atribuição/rejeição
- [ ] Testar fluxo completo
- [ ] Deploy para produção

---

## 🧪 TESTE RÁPIDO

```bash
# Terminal 1: Abrir console
npm start

# Terminal 2: Correr testes
npm test -- testeFluxoSecretaria.test.ts
```

Esperado:
```
✨ TESTE 1 PASSOU! ✨
✨ TESTE 2 PASSOU! ✨
✨ TESTE 3 PASSOU! ✨
🎉 TODOS OS TESTES PASSARAM!
```

---

## 🎯 FLUXO VISUAL (3 PASSOS)

### Triagem

```
MOMENTO 1              MOMENTO 2              MOMENTO 3
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  PACIENTE   │      │ SECRETÁRIA  │      │  DENTISTA   │
│ submitTriagem      │ vê na fila  │      │  responde   │
│    ↓        │      │    ↓        │      │     ↓       │
│Status changed      │  aprova     │      │Status changed
│= "triagem_" │      │ atribui     │      │= "respondida"
│"pendente_"  │ ───► │    ↓        │ ───► │             │
│"secretaria" │      │Status changed      │             │
└─────────────┘      │= "pendente"│      └─────────────┘
                     └─────────────┘
```

### Agendamento

```
MOMENTO 1              MOMENTO 2              MOMENTO 3
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  PACIENTE   │      │ SECRETÁRIA  │      │  DENTISTA   │
│ solicita ag │      │ vê na fila  │      │  confirma   │
│    ↓        │      │    ↓        │      │     ↓       │
│Status changed      │  aprova     │      │Status changed
│= "agendado"│      │ atribui +   │      │= "confirmad"
│"_pendente" │ ───► │ data/hora   │ ───► │"_dentista"  │
│"_secretaria"       │    ↓        │      │             │
└─────────────┘      │Status changed      │             │
                     │= "atribuido"       │             │
                     │"_dentista" │      └─────────────┘
                     └─────────────┘
```

---

## 📱 INTERFACE SECRETÁRIA

```
TOP BAR
[Dashboard] [Relatórios] [Senhas] [Perfil] [📋 FILAS]
                                            ▲
                                            └─ NOVO

FILAS CONTENT
┌─────────────────────────────────────────┐
│ Triagens (3)        Agendamentos (2)    │
├─────────────────────────────────────────┤
│ 👤 João Silva       👤 Maria Santos      │
│ Dor intensa (9/10)  Avaliação/Alta     │
│ [Rejeitar][Atrib]   [Rejeitar][A+DH]   │
├─────────────────────────────────────────┤
│ 👤 Carlos           (vazia)              │
│ Sangramento (7/10)                      │
│ [Rejeitar][Atrib]                       │
└─────────────────────────────────────────┘
```

---

## ⚠️ ERROS COMUNS

### Erro: "Type 'triagem_pendente_secretaria' não existe"
**Solução:** Execute o SQL para adicionar o enum

### Erro: "Column 'secretario_id' não existe"
**Solução:** Execute o SQL para adicionar as colunas

### Triagem não aparece na fila
**Solução:** Verifique se o status está correto no banco

### Dashboard não mostra aba "Filas"
**Solução:** Você não adicionou a aba ainda (integração manual)

---

## 🔗 LINKS IMPORTANTES

**Arquivo** | **Conteúdo** | **Tempo Leitura**
---|---|---
QUICK_START_SECRETARIA.md | 5 passos para implementar | 10 min
ARQUITETURA_FLUXO_SECRETARIA.md | Técnico detalhado | 20 min
DIAGRAMA_VISUAL_FLUXO.md | Diagramas e visuais | 15 min
GUI_IMPLEMENTACAO_SECRETARIA.md | Para secretárias | 15 min

---

## 💡 DICAS PRO

1. **Usar auto-complete:**
   ```typescript
   // Veja sugestões de status
   const status: TriagemStatus = ''; // TypeScript sugere
   ```

2. **Testar offline:**
   ```typescript
   // O sistema faz sync automático quando conectar
   await offlineSyncService.syncPending();
   ```

3. **Monitorar performance:**
   ```typescript
   // Índices já criados
   CREATE INDEX idx_triagens_status ON triagens(status);
   ```

4. **Debug fácil:**
   ```typescript
   console.log('Status:', triagem.status);
   console.log('Atribuída por:', triagem.secretario_id);
   console.log('Atribuída em:', triagem.updated_at);
   ```

---

## 📞 SUPORTE

**Problema?**
1. Verifique CHECKLIST_IMPLEMENTACAO.md
2. Leia QUICK_START_SECRETARIA.md
3. Consulte DIAGRAMA_VISUAL_FLUXO.md
4. Veja logs: `console.error()`

---

## ✨ RESUMO

```
ANTES:
└─ Paciente → Dentista

DEPOIS:
└─ Paciente → Secretária → Dentista
              (validação + atribuição)

BENEFÍCIO:
✅ Controle centralizado
✅ Validação de dados
✅ Distribuição inteligente
✅ Rastreabilidade
```

---

**Pronto?** Vá para **QUICK_START_SECRETARIA.md** PASSO 1! 🚀
