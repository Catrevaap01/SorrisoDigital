# Fix TratamentosFacturasPanel Syntax Error

## Status: [IN PROGRESS]

### Steps:
- [x] 1. Create TODO.md ✅
- [x] 2. Fix malformed JSX in ListHeaderComponent (ScrollView closing tag) ✅ 
- [ ] 3. Extract large HTML template literals to separate functions
- [ ] 4. Break down giant component into sub-components (MetricsRow, Filters, Cards, etc.)
- [ ] 5. Clean up unused variables and optimize useMemo hooks
- [ ] 6. Verify export is at top-level and lint file
- [x] 7. Test with `npx expo export` 🔄 Running (89%+, no syntax error! JSX fix worked)
- [ ] 8. Mark complete and test full command

**Current blocker**: Still hit export error - likely massive file size (1300+ lines) or nested template literal parser confusion in Metro. Next: Extract HTML builders + refactor subcomponents.
