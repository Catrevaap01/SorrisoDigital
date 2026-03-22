# Fix GerirPacientesScreen.tsx TS Errors
Status: In Progress

## Steps:
- [x] 1. Create TODO.md with plan steps
- [x] 2. Add missing import useNavigation + CompositeNavigationProp
- [x] 3. Fix Props type from BottomTabScreenProps to correct navigator type
- [x] 4. Fix setField typing for keyof FormData and documentos_urls handling  
- [x] 5. Remove (as any) cast in salvarPaciente for genero
- [x] 6. Replace navigation.getParent<any>() with typed useNavigation hook (lines ~264,272)
- [x] 7. Add proper null guards for ServiceResult.data
- [x] 8. Fix map loops typing with as const
- [x] 9. Update TODO.md with [x] completion
- [x] 10. Run typecheck verification
- [x] 11. attempt_completion

**✅ Task Complete: GerirPacientesScreen.tsx error-free**
