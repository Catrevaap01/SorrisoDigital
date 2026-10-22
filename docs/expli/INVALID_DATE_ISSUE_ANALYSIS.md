# "Invalid Date" Issue Analysis - Consulta de Rotina Appointments

## Summary
The "Invalid Date" error occurs when appointment dates are formatted for display. The root cause is improper date parsing in multiple locations where `new Date()` is called with date strings in `YYYY-MM-DD` format.

## Key Files and Locations

### 1. **[src/utils/helpers.ts](src/utils/helpers.ts)** - Date Formatting Functions (Lines 1-50)
```typescript
/**
 * Formata data para padrão dd/MM/yyyy
 */
export const formatDate = (date: string | Date, pattern: string = 'dd/MM/yyyy'): string => {
  if (!date) return '';
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) {
    return typeof date === 'string' ? date : '';
  }
  return format(parsedDate, pattern, { locale: ptBR });
};

/**
 * Formata data e hora
 */
export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, "dd/MM/yyyy 'às' HH:mm");
};
```

**Analysis**: The `formatDate` function CORRECTLY uses `parseISO()` from date-fns, but it only does this when a DATE-ONLY string comes in. The problem is in the SERVICE LAYER where dates are being parsed BEFORE being passed to these helpers.

---

### 2. **[src/services/agendamentoService.ts](src/services/agendamentoService.ts)** - PROBLEM LOCATION (Lines 329, 335, 384, 390)

#### Line 329 - agendarAgendamento():
```typescript
formatDate(new Date(data.appointment_date), "dd/MM/yyyy 'às' HH:mm")
```

#### Line 335 - scheduleAppointmentReminder():
```typescript
formatDate(new Date(data.appointment_date), "dd/MM/yyyy 'às' HH:mm")
```

#### Line 384 - confirmarAgendamento():
```typescript
formatDate(new Date(data.appointment_date), "dd/MM/yyyy 'às' HH:mm")
```

#### Line 390 - confirmarAgendamento() (second call):
```typescript
formatDate(new Date(data.appointment_date), "dd/MM/yyyy 'às' HH:mm")
```

**Problem**: When `data.appointment_date` is a DATE-only string like `"2026-04-14"`, calling `new Date()` on it can result in Invalid Date due to timezone issues. The code should pass the raw string to `formatDate()` instead, which will use `parseISO()` correctly.

---

### 3. **[src/screens/secretario/SecretarioAgendamentosScreen.tsx](src/screens/secretario/SecretarioAgendamentosScreen.tsx)** - Line 230
```typescript
{item.appointment_date ? formatDateTime(item.appointment_date) : 'Sem horario'}
```
**Status**: ✓ CORRECT - Properly using formatDateTime()

---

### 4. **[src/components/AppointmentCard.tsx](src/components/AppointmentCard.tsx)** - Line 38
```typescript
<Text style={styles.value}>{appointment.appointmentDate || 'Não definido'}</Text>
```
**Status**: ⚠️ NOT FORMATTING - Displaying raw date string without formatting

---

### 5. **[src/screens/secretario/AtribuirDentistaAgendamentoScreen.tsx](src/screens/secretario/AtribuirDentistaAgendamentoScreen.tsx)** - Line 142
```typescript
{agendamento?.appointment_date ? formatDateTime(agendamento.appointment_date) : '—'}
```
**Status**: ✓ CORRECT - Properly using formatDateTime()

---

### 6. **[src/screens/paciente/TriagemDetalheScreen.tsx](src/screens/paciente/TriagemDetalheScreen.tsx)** - Line 116
```typescript
<Text style={styles.value}>{formatDateTime(data.data_agendamento)}</Text>
```
**Status**: ✓ CORRECT - Properly using formatDateTime()

---

### 7. **[src/screens/dentista/DashboardScreen.tsx](src/screens/dentista/DashboardScreen.tsx)** - Line 555
```typescript
formatRelativeTime(item.appointment_date)
```
**Status**: ⚠️ POTENTIAL ISSUE - formatRelativeTime should handle this, but if appointment_date is null/undefined, could cause problems

---

### 8. **[src/screens/dentista/AgendaDentistaScreen.tsx](src/screens/dentista/AgendaDentistaScreen.tsx)** - Line 107
```typescript
const hora = new Date(item.appointment_date || 0).toLocaleTimeString('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});
```
**Status**: ⚠️ PROBLEMATIC - Using `new Date()` on appointment_date directly

---

### 9. **[src/types/appointment.ts](src/types/appointment.ts)** - Date Type Definition (Line 24, 40, 50, 62)
```typescript
appointmentDate?: string | null;  // Stored as YYYY-MM-DD (DATE type in SQL)
```

---

## Database Schema Reference
From **[docs/SETUP_COMPLETO.sql](docs/SETUP_COMPLETO.sql)** - Line 92:
```sql
appointment_date DATE,  -- Stored as DATE type, not TIMESTAMP
```

---

## Where "Consulta de Rotina" is Referenced

1. **[src/utils/constants.ts](src/utils/constants.ts)** - Line 393
```typescript
{ label: 'Consulta de Rotina', ... }
```

2. **[src/screens/paciente/AgendamentoScreen.tsx](src/screens/paciente/AgendamentoScreen.tsx)** - Line 34
```typescript
{ id: 'consulta', label: 'Consulta de Rotina', icon: 'calendar', cor: COLORS.primary }
```

---

## Root Cause
When `appointment_date` is retrieved from Supabase as a DATE-only string (e.g., `"2026-04-14"`):
- ✓ Passing to `formatDate()` or `formatDateTime()` works fine
- ✗ Passing to `new Date()` constructor first causes timezone misinterpretation → "Invalid Date"

## Solution
Replace all instances of:
```typescript
formatDate(new Date(data.appointment_date), ...)
// or
new Date(data.appointment_date).toLocaleTimeString(...)
```

With:
```typescript
formatDate(data.appointment_date, ...)
// or use formatDateTime(data.appointment_date)
```

The helper functions already handle proper ISO date parsing internally.
