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

## Layer 1 (translation & voice)
- **Incoming voice playback** — `VoiceBubble` with ExoPlayer (Media3); waveform progress + duration.
- **Transcript / translation display** — incoming audio shows Gemini transcript and auto-translated text inline.
- **TTS speaker** — tap the speaker icon on any text/voice bubble to hear Gemini TTS audio.
- **Outgoing translate** — composer send-mode toggle (Aa / speaker flag); text is translated before send when a target language is set.
- **Outgoing voice note** — voice send-mode: text is sent as a Gemini TTS voice note (+ paired translated text bubble).
- **Mic → transcribe** — hold mic button to record; Gemini transcribes speech into the draft field; send translates as normal.
- **Per-chat language** — bottom-sheet language picker stores the chat's target language; falls back to global preference.
- **Global language** — Settings screen exposes a global default language (18 languages + flags).
- **Profile photos** — chat header and message avatars load tokenised profile-pic URLs via Coil with 24 h cache.
- **RECORD_AUDIO** permission is requested at runtime before the first mic recording.
