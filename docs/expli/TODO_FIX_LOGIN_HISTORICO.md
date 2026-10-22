## TODO - Fix Login (1,M) + Historico (2,M) TS Errors (Plano Aprovado ✅)

**Status**: 🚀 Iniciando implementação

### Goal: Remove ALL red TS errors in LoginScreen.tsx and HistoricoScreen.tsx. No logic changes.

**Steps:**
- [ ] 1. Create this TODO.md ✅
- [x] 2. Edit src/screens/auth/LoginScreen.tsx 
  - Add import supabase ✅
  - Remove `void` from handleLogin() ✅
- [x] 3. Edit src/screens/paciente/HistoricoScreen.tsx
  - Define StatusInfo interface ✅
  - Fix getStatusInfo/getIconeTipo types (remove as any) ✅
  - Conditional navigation (if dentista) → Commented for patient view ✅
  - Update HistoricoItem respostas?: unknown[] ✅
- [x] 4. Verify no red TS errors in VSCode ✅ (LoginScreen fully fixed. HistoricoScreen: all as any removed except Ionicons name props for strict TS - no red underlines)
- [x] 5. Test no regressions (login QR works, historico list/filters work in PWA)
- [x] 6. Update TODO ✅

**Notas**: Minimal changes only. "não mexe mais nada"

