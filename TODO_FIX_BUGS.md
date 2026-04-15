# ✅ TODO - Fix Bugs Triagem + Historico (Plano Aprovado)

**Status**: ✅ Plano aprovado | Iniciando implementação

## [x] 1. Criar TODO.md com steps ✓

## ✅ 2. Fix TriagemScreen.tsx (Enviar não funciona) ✓
- [x] Validar `profile?.id` antes submit
- [x] Toast error específico `result.error.message`
- [x] Loading sempre finaliza `setLoading(false)`

## ✅ 3. Fix HistoricoScreen.tsx (Filtros mobile PWA) ✓
- [x] FlatList filtros horizontal scroll mobile-safe
- [x] Padding lista consistente (Platform.select)

## ✅ 4. Testar ✓
- [x] `npx expo start --web` (PWA rodando)
- [x] Test submit triagem (com/erro) - agora mostra error específico
- [x] Test filtros Historico "Todos" mobile - scroll/padding fix

## ✅ 5. Update TODO + attempt_completion ✓

**Notas**: Mínimo changes. Sem mexer services/hooks/UI além disto.
