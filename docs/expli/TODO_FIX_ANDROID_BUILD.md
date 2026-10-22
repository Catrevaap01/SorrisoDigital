# TODO: Fix Android EAS Build (No Code Changes Required)
✅ **Plan Approved by User**

## Current Status: Pending Execution

### Step 1: Update EAS CLI & Login
```
npm install -g eas-cli@latest
eas login
```

### Step 2: Clear Caches & Reinstall
```
rm -rf node_modules package-lock.json
npm install
```

### Step 3: Configure EAS Credentials (Critical!)
```
eas credentials
```
- Select **Android**
- Choose **preview** profile
- **Upload keystore** or **Let EAS handle** (recommended)

### Step 4: Configure Build (Auto-updates eas.json)
```
eas build:configure
```

### Step 5: Build with Preview Profile + Clear Cache
```
eas build -p android --profile preview --clear-cache
```

### Step 6: If Still Fails - Check Logs
1. Go to: https://expo.dev/accounts/antoniotati/projects/TeOdontoAngola/builds
2. Click failed build → **"Run gradlew"** phase
3. Copy **exact error** here

### Expected Result
✅ New APK download link in Expo dashboard

## Commands Summary (Copy-Paste All)
```bash
npm install -g eas-cli@latest && eas login && rm -rf node_modules package-lock.json && npm install && eas credentials && eas build:configure && eas build -p android --profile preview --clear-cache
```

**Mark as COMPLETE once APK downloads successfully!**

