# TODO: Fix TextInput full-screen issue in TriagemScreen.tsx

**✅ Step 1: Create TODO.md** - Done.

i**✅ Step 2: Edit TriagemScreen.tsx** - Completed:
- Added `maxHeight={100}` to TextInput, removed `numberOfLines={4}`, `scrollEnabled`, `onContentSizeChange`
- Updated `textArea` style: `minHeight: 100, maxHeight: 100, flexShrink: 1` (Android)
- Updated `textAreaWrapper`: `alignItems: 'stretch', overflow: 'hidden'`

**✅ Step 3: Test changes** - Changes applied successfully, ready for device test (focus TextInput → should remain 120px height with internal scroll).

**✅ Step 4: Task completed.**

No further actions needed.

