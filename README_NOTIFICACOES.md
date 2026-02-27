# Sistema de Notificações - Guia Rápido

## O que foi implementado?

Sistema automático e inteligente de notificações que:

✅ **Notifica Dentista** quando paciente envia triagem  
✅ **Notifica Paciente** com feedback automático baseado na severidade  
✅ **Notifica Paciente** quando dentista responde à triagem  
✅ **Mostra Recomendações** de cuidados personalizadas  
✅ **Tela Dedicada** para ver todas as notificações  

## Como Funciona

### Fluxo 1: Paciente Envia Triagem

```
Paciente preenche TriagemScreen
        ↓
Clica em "Enviar Triagem"
        ↓
criarTriagem() é executado:
        ├─ 📸 Upload de imagens
        ├─ 💾 Salva triagem no banco
        ├─ 👨‍⚕️ Notifica TODOS os dentistas
        └─ 💬 Envia feedback inteligente ao paciente
        
Paciente recebe 2 coisas:
├─ Feedback automático com recomendações
└─ Aba "Notificações" fica com indicador
```

### Fluxo 2: Dentista Responde

```
Dentista abre "Dashboard"
        ↓
Vê notificação: "Nova Triagem Recebida"
        ↓
Clica, abre CasoDetalhe
        ↓
Escreve resposta
        ↓
Clica "Enviar"
        ↓
responderTriagem() é executado:
        ├─ 📝 Salva resposta
        ├─ ✅ Marca triagem como "respondido"
        └─ 🔔 Notifica PACIENTE
        
Paciente recebe notificação:
├─ "Triagem Respondida"
└─ "Dr. Silva respondeu à sua triagem"
```

## Feedback Automático

Com base na **dor** e **duração**, paciente recebe:

### 🚨 URGÊNCIA (Procure atendimento imediato)
- Dor ≥ 8 **OU** Duração ≥ 1 semana
- Recomendações:
  - Procure um dentista em até 24 horas
  - Evite alimentos duros e quentes
  - Tome anti-inflamatório se dor intensa

### 🔔 ALERTA (Agende consulta em breve)
- Dor 5-7
- Recomendações:
  - Agende consulta nos próximos dias
  - Evite produtos muito quentes/frios
  - Mantenha a área limpa

### 💡 CONSELHO (Dicas gerais)
- Dor < 5
- Recomendações:
  - Escove os dentes 2x ao dia
  - Use fio dental diariamente
  - Enxágue com água morna e sal

## Onde Ver Notificações?

### Pacientes
- Nova aba: **Notificações** (ícone de sino)
- Mostra todas as notificações
- Marca como lida ao tocar
- Pull-to-refresh para carregar novas

### Dentistas
- Nova aba: **Notificações** (ícone de sino)
- Vê todas as triagens que recebeu
- Sabe quem respondeu o quê
- Feedback que os pacientes receberam

## Tipos de Notificações

| Tipo | Ícone | Cor | Para Quem | Quando |
|------|-------|-----|----------|--------|
| Triagem Enviada | 🏥 | Azul | Dentista | Paciente envia triagem |
| Triagem Respondida | ✅ | Verde | Paciente | Dentista responde |
| Urgência | 🚨 | Vermelho | Paciente | Dor ≥ 8 |
| Feedback Saúde | ℹ️ | Azul | Paciente | Automático |
| Conselho | 💡 | Laranja | Paciente | Automático |

## Como Usar

### Para Testar

1. **Criar nova triagem**
   - Paciente: Triagem → Preenche dados → Clica "Enviar"
   - Deve aparecer notificação no Dashboard do dentista

2. **Ver notificação**
   - Abra a aba "Notificações"
   - Veja feedback automático com recomendações

3. **Dentista responde**
   - Dashboard → Clica na notificação
   - Abre CasoDetalhe → Escreve resposta → Envia
   - Paciente recebe notificação de resposta

## Configuração Necessária

### 1. Executar SQL

```bash
# No Supabase SQL Editor, execute:
scripts/setup-notificacoes.sql
```

Isso cria:
- Tabela `notificacoes`
- Índices para performance
- Row Level Security (RLS)
- Triggers para atualizar timestamps

### 2. Verificar Se Funcionou

```sql
-- No Supabase SQL Editor:
SELECT COUNT(*) FROM notificacoes;
-- Deve retornar 0 (ou número de notificações criadas)
```

## Arquivos Criados/Modificados

### Criados
- `src/services/notificacoesService.ts` ✨ Lógica de notificações
- `src/screens/shared/NotificacoesScreen.tsx` ✨ Tela de notificações
- `scripts/setup-notificacoes.sql` ✨ Setup do banco

### Modificados
- `src/services/triagemService.ts` 🔄 Dispara notificações
- `src/navigation/AppNavigator.tsx` 🔄 Adiciona aba

### Documentação
- `NOTIFICACOES_IMPLEMENTATION.md` 📚 Documentação técnica
- `NOTIFICACOES_DATABASE_SETUP.md` 📚 Setup do banco
- `README_NOTIFICACOES.md` 📚 Este arquivo

## Exemplos de Recomendações por Sintoma

### Sangramento na Gengiva
```
✓ Use escova macia para não irritar mais
✓ Evite alimentos muito quentes ou picantes
✓ Enxágue com água morna e sal
```

### Cárie
```
✓ Reduza açúcar na dieta
✓ Use enxaguante bucal sem álcool
```

### Bruxismo (Ranger os dentes)
```
✓ Procure dormir melhor
✓ Tente relaxar antes de dormir
✓ Considere usar protetor noturno
```

## Interface da Tela de Notificações

```
┌───────────────────────────────────┐
│  Notificações                  🔄 │
├───────────────────────────────────┤
│                                   │
│ ⚡ [NÃO LIDA]                      │
│  Atenção: Procure atendimento    │
│  Atenção: Procure atendimento... │
│  ✓ Procure um dentista em 24h    │
│  ✓ Evite alimentos duros         │
│  Faz 5 minutos                   │
│                                   │
│ ✅ [LIDA]                         │
│  Triagem Respondida              │
│  Dr. Silva respondeu à sua...    │
│  Faz 2 horas                     │
│                                   │
│ 🔔 [NÃO LIDA]                    │
│  Nova Triagem Recebida           │
│  João Silva enviou triagem...    │
│  Faz 3 horas                     │
│                                   │
└───────────────────────────────────┘
```

## Performance e Segurança

✅ **Índices otimizados** para busca rápida  
✅ **RLS** garante que usuário só vê suas notificações  
✅ **Limpeza automática** de notificações antigas  
✅ **Sem N+1 queries** (queries eficientes)  
✅ **Validação de tipos** de notificação  

## Próximas Melhorias (Opcionais)

- [ ] Notificações push (Expo Notifications)
- [ ] Som ao receber notificação urgência
- [ ] Badge counter na aba (mostra número)
- [ ] Notificações em tempo real (Supabase Realtime)
- [ ] Email resumido diário
- [ ] Arquivo de notificações antigas
- [ ] Filtro por tipo na tela

## Troubleshooting

### Notificações não aparecem

1. ✓ Executou o SQL setup?
   ```bash
   scripts/setup-notificacoes.sql
   ```

2. ✓ Supabase tem a tabela `notificacoes`?
   ```sql
   SELECT * FROM notificacoes LIMIT 1;
   ```

3. ✓ RLS está habilitado?
   ```sql
   SELECT * FROM information_schema.table_privileges 
   WHERE table_name = 'notificacoes';
   ```

### Paciente não recebe feedback automático

- Verifique se `gerarFeedbackAutomatico()` é chamado
- Verifique console.log para erros
- Cheque se `enviarFeedbackPaciente()` está funcionando

### Dentista não recebe notificação de triagem

- Verifique se triagem foi inserida corretamente
- Confirme que existe pelo menos 1 dentista no banco
- Verifique RLS permissions

## Documentação Detalhada

Para entender a implementação técnica:

1. **NOTIFICACOES_IMPLEMENTATION.md** - Arquitetura completa
2. **NOTIFICACOES_DATABASE_SETUP.md** - Setup e schema do banco
3. **src/services/notificacoesService.ts** - Código comentado

## Suporte

Se tiver dúvidas:

1. Verifique os arquivos de documentação
2. Leia os comentários no código
3. Teste fluxos passo a passo
4. Verifique logs no console/Supabase

---

**Status**: ✅ Implementação Completa  
**Data**: 2026-02-27  
**Versão**: 1.0
