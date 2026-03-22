# Web Triagem Upload Fix - Progress

**✅ PLAN APPROVED** - Fixing Web image upload failure

**Current Steps:**
**⏳ 1. Update storageService.ts** - Web-compatible base64 conversion + parallel uploads
**⏳ 2. Test: npx expo start --web**
**⏳ 3. Verify Supabase Storage + triagens table**
**⏳ 4. UX improvements (optional)**

**Root Cause:** expo-file-system fails with Web blob URLs
**Fix:** Platform.OS==='web' → fetch(blob)→FileReader→base64

**Test after fix:**
1. Fill triagem form
2. Add images from gallery
3. Submit → check browser console + Supabase dashboard

