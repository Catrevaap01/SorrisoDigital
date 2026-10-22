# TODO - Fix EducacaoScreen 5M Errors (categoria + return)

Status: ✅ Starting implementation | Zero errors goal

## Plan:
Fix 3x `conteudo.categoria`/`conteudoSelecionado.categoria` + `return` issues:
1. Null-checks + defaults for category badge/icon/color
2. Type guard for conteudoSelecionado
3. Fix any early/missing return logic
4. Add Toast error handling
5. Test offline/empty states

## Steps:
- [x] Create TODO.md
- [x] Edit EducacaoScreen.tsx (all 5 fixes: null-checks/defaults/Toast)
- [x] `npx tsc --noEmit` (fixing remaining TS warnings)
- [ ] Test web/mobile
- [ ] Test web: `npx expo start --web`
- [ ] Update TODO + complete

