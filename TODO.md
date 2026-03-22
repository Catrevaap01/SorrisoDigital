# ✅ FIX_PDF_EXPORT_PATIENT_SERVICE

**Status: In Progress** (Approved by user)

## Steps:

### [x] 1. Create this TODO.md
### [ ] 2. Fix PDF Export - src/utils/pdfExportUtils.ts
- Replace popup with jsPDF canvas (no popup block)
- Better image handling + QR inline
- Mobile FileSystem fallback

### [ ] 3. Fix PacienteService - src/services/pacienteService.ts  
- Admin key validation
- Simplify upsert/RLS
- Better error handling/logging

### [ ] 4. Update screens UX
- GerirPacientesScreen.tsx, DentistaRelatorioScreen.tsx

### [ ] 5. Test flows
- PDF web/mobile
- Create/update/list patients

### [ ] 6. attempt_completion
