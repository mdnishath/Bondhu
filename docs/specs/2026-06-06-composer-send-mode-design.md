# Composer Send-Mode Toggle + Translating Loader — Design

**Date:** 2026-06-06
**Status:** Approved (design); implementation pending
**Area:** `web/` (Composer, ChatView), `server/` (TTS, send-voice route, audio transcode), `langs`

## Overview

The composer gets a **two-state send-mode toggle** — **Text** or **Voice** — each
shown with the target language's **country flag + an icon**. The user types in
Banglish (or any language) and:

- **Text mode** → the message is translated to the selected language and sent as
  **text** (current behavior, unchanged).
- **Voice mode** → the message is translated, spoken by **Gemini TTS**, and sent
  as a **WhatsApp voice note (OGG/Opus)**, *and* the translated **text** is sent
  as a second message. Recipient gets both.

The plain `…translating…` placeholder is replaced by a small **animated loader**
(globe + bouncing dots) so sending feels polished.

## Decisions (locked)

- Voice format: **ffmpeg + Gemini voice** — transcode Gemini PCM → OGG/Opus so the
  voice note is native on WhatsApp *and* keeps the Gemini voice. ffmpeg is
  installed on the host as a one-time setup.
- Voice mode delivers **voice + text** (two messages: voice note, then text).
- Voice mode requires a selected target language (the toggle is inert otherwise).

## UI — Composer

Current composer: a text input, a language `<select>` (`→ French`), mic + send
buttons. Changes:

- Add a **mode toggle** next to the language selector with two states, each
  rendering `flag + icon`:
  - **Text:** `🇫🇷 Aa` — title "Send as text in French".
  - **Voice:** `🇫🇷 🎙️` — title "Send as voice in French".
- The toggle reflects `sendMode: 'text' | 'voice'` (component state, default
  `text`, remembered per chat in `localStorage` like `outLang`).
- The flag comes from the language's locale country (`fr-FR → 🇫🇷`,
  `en-US → 🇺🇸`, `bn-IN → 🇮🇳`, …). `ar-XA` has no real country → fallback `🌐`.
- The header line adapts: text mode keeps "Your messages are translated to
  **French** before sending."; voice mode shows "Your messages are sent as a
  **French** voice note (+ text)."
- When no target language is selected (`outLang === ''`), the voice toggle is
  disabled (greyed) — only text/"send as typed" is meaningful.

## UI — Translating loader

A small reusable `TranslatingLoader` component replaces the `…translating…`
string inside the optimistic bubble:

- A 🌐 glyph + three bouncing dots (CSS keyframes in `styles/index.css`).
- Text label depends on mode: text → "Translating → French"; voice →
  "Translating + generating voice 🔊".
- Shown while the send request is in flight; removed when the real content
  arrives or on error.

## Data flow

### Text mode (unchanged)
`Composer.submit → ChatView.send(text, 'text')` → `api.send(acc, jid, text, outLang)`
→ `POST /send` translates (`translateOutgoing`) → `sendText` → returns `sentText`.
Optimistic bubble updates to `sentText`.

### Voice mode (new)
`Composer.submit → ChatView.send(text, 'voice')` →
`api.sendVoiceTranslated(acc, jid, text, outLang)` → `POST /send-voice`:

1. `translated = translation.translateOutgoing(userId, message, translateTo)`
2. `tts = tts.synthesize(...)` → WAV (existing, Gemini, browser-playable)
3. `ogg = transcode.wavToOpus(wavBuffer)` → OGG/Opus buffer
4. `voiceMsgId = manager.sendVoice(acc, chatId, ogg)` (ptt, correct opus mimetype)
5. `textMsgId = manager.sendText(acc, chatId, translated)`
6. respond `{ success, voiceMsgId, textMsgId, sentText: translated, original,
   audioBase64: tts.audioBase64, mime: tts.mime }`

Client optimistic UI (voice mode): one loader bubble while in flight; on success
render **(a)** a voice bubble that plays the returned `audioBase64` locally (data
URI — no `/api/media` round-trip for own audio) and **(b)** a text bubble with
`sentText`. On error, reset to the typed text and show a small error.

## Backend components

### `server/src/ai/transcode.ts` (new)
- `wavToOpus(input: Buffer): Promise<Buffer>` — spawns ffmpeg
  `ffmpeg -i pipe:0 -c:a libopus -b:a 24k -f ogg pipe:1`, writes `input` to stdin,
  collects stdout. Rejects on non-zero exit with stderr tail.
- Single responsibility: audio container/codec conversion. No knowledge of WA/TTS.
- ffmpeg binary path: rely on PATH; configurable via `FFMPEG_PATH` env override.

### `/send-voice` route (enhanced, `ai.routes.ts`)
- Body: `{ chatId, message, translateTo? }` (was `{ chatId, text, language }`;
  no current web caller, so safe to change — verify in tests).
- Translates when `translateTo` set, else speaks `message` as-is.
- Orchestrates translate → synthesize → transcode → sendVoice → sendText.
- Errors: any step failure → 500 `{ error }`; nothing partially sent is masked
  (if voice send succeeds but text fails, report which ids succeeded).

### `manager.sendVoice` / `wa-connection.sendVoice`
- Already sets `{ audio, ptt: true, mimetype: 'audio/ogg; codecs=opus' }`. Now the
  buffer is *actually* opus, so the mimetype is finally correct. No signature change.

### `langs.ts` + language API
- Add `flag: string` to the `Lang` interface and every entry in `SUPPORTED_LANGS`.
- The `GET /language` (or settings/language) response includes `flag` per supported
  language. Web `LangOption` type gains `flag`.

## Frontend components

- `Composer.tsx`: add `sendMode` state + toggle UI; `onSend(text, mode)` signature.
- `ChatView.tsx`: `send(text, mode)` branches text vs voice; voice path calls the
  new api method and manages the voice+text optimistic bubbles.
- `lib/api.ts`: add `sendVoiceTranslated(acc, chatId, message, translateTo)`.
- `lib/format.ts` (or new `flag.ts`): `flagEmoji(locale: string): string` — derive
  regional-indicator emoji from the 2-letter country in a locale, with `ar-XA`
  fallback. (If `flag` is provided by the API, the client just uses it; the helper
  is a fallback.)
- `TranslatingLoader.tsx`: the animated loader.
- `styles/index.css`: keyframes for the loader dots.

## Error handling

- ffmpeg missing/non-zero exit → 500 with a clear message; client shows "voice
  failed" and leaves the typed text in the box for retry.
- No API key (per existing behavior) → translation/TTS throws 500; voice mode
  surfaces it the same way text mode does.
- Transcode produces empty buffer → treated as failure (no empty voice note sent).

## Testing

- `server/src/ai/transcode.test.ts` — `wavToOpus` returns a non-empty OGG buffer
  beginning with the `OggS` magic, for a small synthetic WAV. (Skips with a clear
  message if ffmpeg is unavailable on the test host.)
- `ai.routes` test — `/send-voice` with a mocked translation + TTS + transcode +
  manager: asserts it translates, transcodes, calls `sendVoice` then `sendText`,
  and returns both ids + `sentText` + `audioBase64`.
- Existing 48 tests stay green (the `/send-voice` body change updates its test).
- Frontend: browser-verified (no unit harness) — text mode unchanged, voice mode
  sends both, loader animates, flags render.

## Out of scope (YAGNI)

- Live microphone voice *recording* send (already deferred).
- Per-language pitch / speaking-rate controls.
- Replaying own sent voice via `/api/media` (own audio plays from the returned
  `audioBase64` instead).

## Affected files (summary)

- New: `server/src/ai/transcode.ts`, `server/src/ai/transcode.test.ts`,
  `web/src/components/chat/TranslatingLoader.tsx`.
- Changed (server): `ai/langs.ts`, `api/routes/ai.routes.ts`, language API
  response, `ai/tts.service.ts` (only if a raw-PCM accessor is needed; otherwise
  transcode consumes the WAV).
- Changed (web): `components/chat/Composer.tsx`, `components/chat/ChatView.tsx`,
  `lib/api.ts`, `lib/types.ts`, `lib/format.ts` (or `lib/flag.ts`),
  `styles/index.css`.
- Host: ffmpeg installed (one-time).
