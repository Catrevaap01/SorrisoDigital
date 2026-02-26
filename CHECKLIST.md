# 🚀 Checklist de Implementação

## Fase 1: Segurança e Configuração (Imediata)

- [ ] **Proteger Credenciais**
  - [ ] Criar `.env` local (copiar de `.env.example`)
  - [ ] Adicionar credenciais reais
  - [ ] Verificar que `.env` está em `.gitignore`
  - [ ] Atualizar `app.json` com `extra` config
  - [ ] Testar se credenciais carregam corretamente

- [ ] **Atualizar Dependências**
  - [ ] Executar `npm install` ou `yarn install`
  - [ ] Verificar warnings de segurança: `npm audit`

## Fase 2: Refatoração de Código (Esta Semana)

- [ ] **Migrar AuthContext**
  - [ ] Testar login com novo AuthContext melhorado
  - [ ] Testar signup
  - [ ] Testar logout
  - [ ] Verificar logging

- [ ] **Usar Novos Componentes**
  - [ ] Substituir inputs por `<Input />`
  - [ ] Substituir buttons por `<Button />`
  - [ ] Substituir loaders por `<Loading />`
  - [ ] Usar `<Card />` para listagens

- [ ] **Implementar Validação**
  - [ ] Usar `validators.validate()` em LoginScreen
  - [ ] Usar em RegisterScreen
  - [ ] Usar em AgendamentoScreen
  - [ ] Usar em PerfilScreen

- [ ] **Adicionar Logging**
  - [ ] Importar `logger` em screens principais
  - [ ] Registar eventos importantes
  - [ ] Registar erros com `logger.error()`

## Fase 3: Completar Services (Próxima Semana)

- [ ] **Implementar Services Faltando**
  - [ ] `agendamentoService.js` (estender BaseService)
  - [ ] `conteudoService.js` (estender BaseService)
  - [ ] `triagemService.js` (estender BaseService)
  - [ ] `storageService.js` (ficheiros e imagens)

- [ ] **Testar Services**
  - [ ] Testar CRUD operations
  - [ ] Testar error handling
  - [ ] Testar logging

## Fase 4: Melhorias de UX (Opcional)

- [ ] **Adicionar Animações**
  - [ ] `react-native-reanimated` para transições
  - [ ] Feedback visual em botões
  - [ ] Loading skeletons

- [ ] **Estados de Erro Melhorados**
  - [ ] Telas de erro customizadas
  - [ ] Retry buttons
  - [ ] Offline mode

- [ ] **Notificações**
  - [ ] Toast para confirmações
  - [ ] Push notifications
  - [ ] In-app notifications

## Fase 5: Testing e CI/CD

- [ ] **Testes Unitários**
  - [ ] Testes para validators
  - [ ] Testes para errorHandler
  - [ ] Testes para services

- [ ] **Testes de Integração**
  - [ ] Teste de fluxo de login
  - [ ] Teste de criação de agendamento
  - [ ] Teste de navegação

- [ ] **Setup CI/CD**
  - [ ] GitHub Actions para testes
  - [ ] Linting automático
  - [ ] Build automático

## Fase 6: Otimizações (Quando Estável)

- [ ] **Performance**
  - [ ] Implementar useMemo em listas
  - [ ] Lazy loading de screens
  - [ ] Caching de dados
  - [ ] Virtual lists

- [ ] **TypeScript**
  - [ ] Migrar core files para .ts
  - [ ] Adicionar tipos a components
  - [ ] Setup tipo checking

- [ ] **State Management**
  - [ ] Considerar Redux/Context melhorado
  - [ ] Centralizar estado global
  - [ ] Remover prop drilling

---

## 📋 Verificação Antes de Produção

- [ ] Todas as credenciais em variáveis de ambiente
- [ ] Nenhum `console.log()` em produção
- [ ] Mensagens de erro amigáveis em português
- [ ] Validação em campo obrigatório
- [ ] Loading states em todas as requisições
- [ ] Error handling em todas as operações
- [ ] Testes completos do fluxo principal
- [ ] Performance aceitável em dispositivos antigos
- [ ] App funciona offline (parcialmente)
- [ ] Documentação atualizada

---

## 🔧 Troubleshooting Common

**Problema**: Credenciais não carregam
```
Debug: console.log(Constants.expoConfig?.extra);
Solução: Verificar app.json e reiniciar Expo
```

**Problema**: Erros não aparecem no Toast
```
Solução: Verificar se Toast está importado em App.js
```

**Problema**: Componentes não renderizam
```
Solução: Verificar imports e caminhos relativos
```

**Problema**: Supabase retorna erro 401
```
Solução: Verificar credenciais Supabase
```

---

## 📞 Próximos Passos

1. Implementar Fase 1 (Segurança)
2. Testar app completamente
3. Implementar Fase 2 (Refatoração)
4. Testar novamente
5. Continuar com fases seguintes

**Tempo estimado**: 2-4 semanas de trabalho
