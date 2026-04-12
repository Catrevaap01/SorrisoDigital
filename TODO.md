# Database Rebuild Task - "recostrua o banco de dados para aceitar"

## Status: In Progress

**Approved Plan Summary**: Unified Supabase schema fixing naming (appointments), missing fields (secretary_id), RLS for secretary flow.

### Steps Checklist
- [x] **Step 1**: Create `docs/SUPABASE_REBUILD_COMPLETE.sql` (complete unified schema)
- [ ] **Step 2**: Execute SQL in Supabase (Dashboard > SQL Editor > New Query > Paste &amp; Run)
- [ ] **Step 3**: Verify tables/RLS:
  ```
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
  SELECT * FROM pg_policies WHERE tablename = 'appointments';
  ```
- [ ] **Step 4**: Test app:
  - Login as patient, create appointment/triagem
  - Check inserts succeed (no RLS errors)
  - Login as secretary, assign to dentist
- [ ] **Step 5**: Mark complete, delete/reset if needed

**Next Action**: Run Step 2 after confirming file creation.

