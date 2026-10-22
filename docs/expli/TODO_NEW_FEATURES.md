## TODO - New Features: Single Session + Detail Navigation

**Status**: 📋 Planning

### Information Gathered:
- LoginScreen: No session termination. Add `supabase.auth.signOut()`.
- HistoricoScreen: List with triagem/agendamento (pendente/realizado/etc). TouchableOpacity no onPress.
- No detail screens for patient. Use existing CasoDetalheScreen.

### Plan:
1. LoginScreen.tsx: Add signOut before login.
2. HistoricoScreen.tsx: Add navigation to CasoDetalheScreen on item press.

### Steps:
- [x] 1. User approve plan ✅
- [x] 2. Edit LoginScreen.tsx ✅ (added signOut)
- [x] 3. Edit HistoricoScreen.tsx ✅ (added useNavigation + onPress)
