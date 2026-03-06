# Android Development Environment Setup Guide

> This guide helps fix the error: `spawn adb ENOENT` when building/running the Android app.

---

## ⚠️ Error Explanation

```
adb executable doesn't seem to work
spawn adb ENOENT
Error: build command failed
```

This error occurs because the Android SDK (`adb`) is not found in your system's PATH.

---

## ✅ Solution Options

### Option 1: Use EAS Build (Recommended - No local setup needed)

**Best for**: Quick builds without installing Android Studio

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android (runs on cloud)
eas build -p android
```

**Pros**: No local Android SDK required
**Cons**: Requires Expo account (free tier available)

---

### Option 2: Install Android Studio (For local builds)

#### Step 1: Download and Install Android Studio
1. Download from: https://developer.android.com/studio
2. Run the installer
3. Follow the installation wizard

#### Step 2: Configure Environment Variables

**For Windows:**

1. Open **System Properties** → **Advanced** → **Environment Variables**

2. Add new User variables:
   - Variable: `ANDROID_HOME`
   - Value: `C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk`

3. Add new User variables:
   - Variable: `ANDROID_SDK_ROOT`
   - Value: `C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk`

4. Edit the `Path` variable and add:
   - `C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk\platform-tools`
   - `C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk\tools`

#### Step 3: Verify Installation

Open a new terminal and run:
```bash
adb version
```

You should see:
```
Android Debug Bridge version X.X.X
```

---

### Option 3: Use Expo Go (For Development)

**Best for**: Testing on physical device without building

1. Install **Expo Go** app on your Android phone
2. Run:
   ```bash
   npx expo start
   ```
3. Scan the QR code with Expo Go

---

## 🚀 Quick Commands

| Command | Description |
|---------|-------------|
| `npx expo start` | Start Expo development server |
| `npx expo start --android` | Start with Android emulator |
| `eas build -p android` | Build Android APK on cloud |
| `adb version` | Check if ADB is installed |

---

## 🔧 Troubleshooting

### "adb is not recognized"
→ Environment variables not set correctly. Follow Option 2.

### "ANDROID_HOME not found"
→ Same issue. Set ANDROID_HOME as shown above.

### "Running on Expo Go instead"
→ This is fine for development! Use `npx expo start`.

### "No Android device found"
1. Enable USB debugging on your phone
2. Run: `adb devices` to check connection

---

## 📱 Alternative: Build APK without Android Studio

If you just need an APK to test:

```bash
# Using EAS (recommended)
eas build -p android --profile preview

# Or generate local APK with prebuild
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
```

---

## ✅ Next Steps

1. **For quick testing**: Use `npx expo start` and Expo Go
2. **For CI/CD**: Use `eas build -p android`
3. **For local development**: Install Android Studio and configure environment

---

*Last updated: 2026*

