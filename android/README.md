# Bondhu Android

Native Kotlin/Compose client for the Bondhu backend (REST + Socket.IO).

## Build
Gradle/Java are not required on PATH — use Android Studio's bundled JBR:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat :app:assembleDebug      # build
.\gradlew.bat :app:installDebug       # install on a connected device/emulator
.\gradlew.bat :app:testDebugUnitTest  # unit tests
```
Or open `E:\New Whatsapp\android` in Android Studio and Run.

## Server
- Debug build defaults to `http://10.0.2.2:3050` (emulator → host dev server).
- Release build defaults to `https://wa.client-flow.xyz`.
- The login screen has a **Server URL** field that overrides the default
  (persisted) — set it to `https://wa.client-flow.xyz` to test on a real phone.

## v1 scope
Auth (email/password) → accounts → pair (QR / code) → chat list → text chat,
real-time over Socket.IO while the app is foregrounded. Voice, image, reactions,
reply/forward/edit/delete, translation UI, TTS, settings, and background push
are deferred layers.
