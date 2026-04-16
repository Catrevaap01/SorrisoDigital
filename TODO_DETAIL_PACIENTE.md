## TODO - Add Detail View for Paciente Historico (Triagem/Agendamento)

**Status**: 🔄 Plano aprovado

**Goal**: Paciente pode ver detalhes das triagens/agendamentos no histórico (PWA/mobile).

**Information Gathered**:
- HistoricoScreen.tsx paciente: Navigation comentado (TS error).
- No TriagemDetalheScreen for paciente (PacienteStackParamList).
- CasoDetalheScreen.tsx = dentista-only (read/write).
- Services have data for details.

**Plan** (✅ COMPLETO):
1. [x] Create `src/screens/paciente/TriagemDetalheScreen.tsx` ✅
2. [x] Edit `src/screens/paciente/HistoricoScreen.tsx` → Add navigation ✅
3. [x] Edit `src/navigation/types.ts` → Add TriagemDetalhe ✅

**Dependent Files**: types.ts, HistoricoScreen.tsx.

**Followup**: Test PWA, update TODO ✅.

Approve?
