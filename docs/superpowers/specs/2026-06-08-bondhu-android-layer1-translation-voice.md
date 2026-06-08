# Bondhu Android — Layer 1: Translation & Voice (design)

**Date:** 2026-06-08
**Status:** Proposed
**Builds on:** v1 vertical slice (merged to master). Same backend, same MVVM
architecture. This layer adds Bondhu's core differentiators to the Android app:
two-way translation UI + voice (playback, TTS, outgoing voice, mic→transcribe) +
profile photos. Reference behavior = the React web client (already built).

**Scope source:** approved by user (Layer 1). Contracts confirmed against
`server/src/api/routes/{ai,whatsapp}.routes.ts`, `socket-gateway.ts`, `ai/langs.ts`
and the web client (`web/src/components/chat/*`, `web/src/lib/api.ts`).

---

## 1. Features (parity with web)

1. **Incoming voice** (type `ptt`/`audio`): play/seek bar + duration via
   `/api/media/:msgId`; show auto **transcript** + **translation** sub-sections;
   on-demand **Transcribe** button if transcript missing.
2. **Incoming text translation**: translated sub-text under received bubbles
   (already partially shown; keep + add a TTS speaker on it).
3. **TTS play (Speaker)**: on any text/translated message → `POST /api/tts` →
   play returned `audioBase64`; pulse while playing.
4. **Outgoing translate**: composer language picker → `POST /api/send` with
   `translateTo`; show `sentText` + "you wrote: {original}" sub-label.
5. **Outgoing voice**: composer send-mode toggle (text **Aa** / voice **🎙️**) →
   `POST /api/send-voice` (text→translated TTS voice note + text); own-voice
   replay from the returned `audioBase64` (and `/api/media` fallback).
6. **Mic record → transcribe**: hold/tap mic → record (AAC/m4a) → `POST
   /api/transcribe` → fill composer → send (translates to target). Timer overlay
   + cancel. Needs `RECORD_AUDIO` runtime permission.
7. **Per-chat + global language**: language picker (18 langs, flags);
   `GET/POST /api/settings/language` (global) and `GET/POST
   /api/chats/:chatId/language` (per-chat override; null = use global).
8. **Profile photos**: Coil avatars in chat list + chat header from
   `/api/profile-pic?account=&id=&token=`.

Out of scope here (Layer 2/3): images, reactions, reply/forward/edit/delete,
read-receipt detail, Settings screen, new-chat, profile view, pull-refresh.

---

## 2. Backend contract (confirmed; all under `/api`, Bearer unless noted)

| Endpoint | Method | Params / Body | Response |
|---|---|---|---|
| `/api/tts` | POST | `?account`; `{msgId,text,lang?}` | `{audioBase64,mime}` |
| `/api/transcribe` | POST | `?account`; `{audioBase64,mimeType}` | `{transcript}` |
| `/api/retranscribe` | POST | `?account`; `{msgId}` | `{transcript}` |
| `/api/retranslate` | POST | `?account`; `{msgId,text,chatId}` | `{translated,lang}` |
| `/api/send-voice` | POST | `?account`; `{chatId,message,translateTo?}` | `{success,voiceMsgId,textMsgId,sentText,original?,audioBase64,mime}` |
| `/api/send` | POST | `{account,chatId,message,translateTo?}` | `{success,msgId,sentText,original?}` |
| `/api/media/:msgId` | GET | `?account&token` (JWT in query) | binary audio/image |
| `/api/profile-pic` | GET | `?account&id&token` | binary image / 404 |
| `/api/profile` | GET | `?account&id` | `{jid,about,phoneJid,phone}` |
| `/api/settings/language` | GET | — | `{lang,supported:[{code,name,flag}]}` |
| `/api/settings/language` | POST | `{lang}` | `{success}` |
| `/api/chats/:chatId/language` | GET | `?account` | `{lang: string\|null}` |
| `/api/chats/:chatId/language` | POST | `?account`; `{lang: string\|null}` | `{success}` |

Socket `message` already carries `type`, `transcript`, `translated`,
`senderName` (backend does STT+translate synchronously before emit), so the
live path needs no extra round-trip. History (`GET /api/messages`) returns
`transcript` + cached `translated` + `lang` too.

**Media/profile-pic auth = `?token=<jwt>` query** (the JWT, not a separate
token). Build URLs as `<baseUrl>/api/media/<msgId>?account=<acc>&token=<jwt>`.

---

## 3. Android additions

### 3.1 Data layer
- **`BondhuApi`**: add `tts`, `transcribe`, `retranscribe`, `retranslate`,
  `sendVoice`, `getLanguage`, `setLanguage`, `getChatLanguage`, `setChatLanguage`,
  `profile`. (media/profile-pic are plain GET URLs consumed by the audio player
  / Coil — not Retrofit calls.)
- **DTOs** (`Dtos.kt`): `TtsRequest/TtsResponse`, `TranscribeRequest/Response`,
  `RetranscribeRequest`, `RetranslateRequest/Response`, `SendVoiceRequest/Response`,
  `LanguageResponse{lang,supported:[LangOption{code,name,flag}]}`, `SetLanguageRequest`,
  `ChatLanguageResponse{lang?}`, `SetChatLanguageRequest{lang?}`, `ProfileResponse`.
- **UI models**: extend `Message` with nothing new (already has transcript/
  translated/type). Add `LangOption`, and a `MediaUrls` helper that builds the
  token URLs from `Prefs` (jwt + activeAccount + baseUrl).
- **Repositories**: `ChatRepository` gains `tts/transcribe/retranscribe/
  retranslate/sendVoice/profile`. New **`LanguageRepository`** (global + per-chat
  get/set, exposes the supported list). New **`MediaUrlBuilder`** (singleton)
  for `/media` + `/profile-pic` URLs.
- **`Prefs`**: add per-chat `outLang` and `sendMode` persistence
  (keys `out_lang_<jid>`, `send_mode_<jid>`), plus a cached `jwtBlocking()`
  already available for URL building.

### 3.2 Audio
- **`AudioPlayer`** (Hilt singleton, Media3 ExoPlayer): `playUrl(url)` for media,
  `playBytes(base64, mime)` for TTS/own-voice (write to a temp/cache file →
  ExoPlayer `MediaItem`), `stop()`, and a `StateFlow<PlaybackState>`
  (playingId, positionMs, durationMs) so bubbles can show progress. One player,
  one active clip at a time (mirrors web).
- **`VoiceRecorder`** (Hilt): `MediaRecorder` → AAC in an `.m4a`/MP4 container
  (works minSdk 26; backend ffmpeg auto-detects & transcodes), `start()/stop()
  → base64`, `cancel()`, elapsed-time flow. Requires `RECORD_AUDIO`.
- Add `<uses-permission android:name="android.permission.RECORD_AUDIO"/>` and
  runtime request.

### 3.3 UI (Compose) — new/changed under `ui/chat/`
- **`VoiceBubble`**: waveform-less seek bar + play/pause + duration; sources
  `/media` URL (or `localAudioBase64` for own just-sent voice); transcript +
  translated sub-sections; TTS `Speaker` on the translation.
- **`Speaker`** (TTS button): calls `tts`, plays audio, pulse animation; shown on
  translated text + on any received text.
- **`TranslationText`**: "Translated" label + text (reuse for text + voice).
- **`Composer` upgrade**: send-mode toggle (Aa/🎙️), language picker (flag + name,
  "Send as typed" default), dynamic placeholder, mic button with record overlay
  (timer + slide/tap-to-cancel). Voice mode disabled until a language is chosen.
- **`LanguageSheet`** (ModalBottomSheet): searchable 18-language list (flags) for
  the per-chat picker (and reused later by Settings).
- **`ChatScreen` header**: avatar (Coil) + overflow with "Chat language" →
  LanguageSheet.
- **`ChatRow`** (chat list): Coil avatar from `/profile-pic` (replacing the
  initials-only Avatar, with initials as fallback/placeholder).

### 3.4 ViewModel
- **`ChatViewModel`**: add `tts(msg)`, `retranscribe(msg)`, `playVoice(msg)`,
  `setSendMode`, `setOutLang`, `startRecording/stopRecording/cancelRecording`
  (→ transcribe → draft), and a `sendVoice()` path with optimistic voice+text
  bubbles + partial-failure handling. Load per-chat language on `bind`, expose
  `outLang`, `sendMode`, `supportedLangs`, `recording` state.
- Live merge already handled by `upsert` (transcript/translated arrive in the
  single `message` event).

---

## 4. Key decisions / gotchas
- **Mic format:** record AAC/m4a (minSdk-26-safe); backend ffmpeg transcodes —
  **verify on device** that `/transcribe` accepts m4a (web sends webm; ffmpeg
  auto-detects, so expected OK; fallback = OGG/Opus on API 29+).
- **Token-in-URL:** media/profile-pic use `?token=<jwt>`; build via a singleton
  that reads `Prefs` synchronously. Coil loads the URL directly (no header
  interceptor needed since the same OkHttp `HostSelectionInterceptor` would also
  rewrite host — use a **separate Coil OkHttp client WITHOUT** the host/auth
  interceptors, since the URL is already absolute+tokenised). Simplest: build a
  fully-absolute URL (`baseUrl + path + query`) and give Coil a plain client.
- **Own-voice replay:** use the `audioBase64` from `send-voice` immediately
  (`playBytes`); `/media/:voiceMsgId` is the refresh fallback (TTS cache).
- **send-voice dedupe:** WhatsApp echoes the text msg via socket; the optimistic
  text bubble uses the returned `textMsgId` so `upsert` replaces it (same pattern
  as v1 text send). The voice bubble uses `voiceMsgId`.
- **Language resolution** for display already happens server-side; the picker
  just sets per-chat/global and triggers a message reload so caches refresh.
- **AudioPlayer lifecycle:** release ExoPlayer when the app stops; one instance
  shared, stop previous clip when a new one starts.

---

## 5. Build phasing (plan tasks, each builds + commits)
1. DTOs + BondhuApi endpoints + `MediaUrlBuilder` (+ TDD path/shape tests).
2. `ChatRepository` + `LanguageRepository` methods (+ TDD via MockWebServer).
3. `Prefs` per-chat outLang/sendMode.
4. `AudioPlayer` (Media3) singleton + DI.
5. `VoiceRecorder` + RECORD_AUDIO permission.
6. `Tts/Speaker` + `TranslationText` components; wire into `MessageBubble` for text.
7. `VoiceBubble` (player + transcript/translation) into `MessageBubble` for voice.
8. Profile photos: Coil avatar in `ChatRow` + chat header.
9. `Composer` upgrade: mode toggle + language picker + dynamic placeholder.
10. Mic record flow (overlay + transcribe → draft) in Composer/ChatViewModel.
11. Outgoing translate + send-voice paths in `ChatViewModel` (optimistic bubbles).
12. Per-chat `LanguageSheet` + header overflow; load/set per-chat language.
13. Integration + build + device acceptance (voice in/out, TTS, translate, mic, avatars).

---

## 6. Acceptance (device, live server)
Open a chat → received voice plays + shows transcript/translation → tap Speaker
hears TTS → pick a language → type & send (recipient gets translated text; bubble
shows "you wrote…") → switch to 🎙️ voice mode, send (recipient gets a voice note)
→ hold mic, speak Bangla, release (transcript fills, sends translated) → avatars
load in list + header.
