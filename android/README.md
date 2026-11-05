# Siddur for Android

A small Android app that wraps the siddur page (`../dist/index.html`) in a full-screen WebView. It runs fully offline: the text, the day logic and the Hebrew font are bundled in the app. The screen stays on while it's open.

## Install on a phone

1. Download `apk/siddur-debug.apk` from this branch (or the `siddur-debug-apk` artifact from the latest **Android build** run in the Actions tab).
2. Open it on the phone. Android will ask you to allow installs from your browser or file manager the first time ("Install unknown apps"). Allow it, then tap **Install**.

It's a debug build, signed with a debug key, so Play Protect may warn that it's from an unknown developer. That's expected for an app not from the Play Store.

## Build it yourself

From the repository root:

```
node tools/build-data.js && node tools/build.js && node tools/android-assets.js
cd android
./gradlew assembleDebug        # needs JDK 17+ and the Android SDK (ANDROID_HOME)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Or open the `android/` folder in Android Studio and press Run.

## Details

- Package `com.samuelreisen.siddur`, min Android 7.0 (API 24), target API 35.
- Links to websites open in the phone's browser.
- Settings and mourner details are kept in the app's local storage on the device.
- Font: Frank Ruhl Libre, SIL Open Font License (`app/src/main/assets/fonts/OFL.txt`).
