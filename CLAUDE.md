# Bondhu — Project Memory (read this first every session)

> **For Claude:** This file is the source of truth for continuing work on Bondhu.
> Read it fully before doing anything. The user should NOT have to re-explain the
> project. Reply to the user in **Bengali/Banglish**, be concise, show results.

## What this is
**Bondhu** = a multi-account WhatsApp client with **two-way live translation**
(type in Banglish/Bengali → recipient gets their language; their reply → auto
Bengali). Rebuilt fresh from an older `E:\whatsapp` project, replacing
whatsapp-web.js (puppeteer/Chrome) with **Baileys** (WebSocket, no Chrome).

- **Location:** `E:\New Whatsapp`
- **GitHub:** https://github.com/mdnishath/Bondhu (public, branch `master`, SSH remote, `gh` authed as mdnishath)
- **VPS (old project, separate):** `ssh root@144.79.218.148`, old app at `/opt/whatsapp-mcp` (pm2 `whatsapp-mcp`, port 3050, domain wa.client-flow.xyz). Bondhu is NOT deployed there yet.

## Structure
```
server/   Node+TS backend (Baileys, SQLite, REST, Socket.IO, AI). 48 tests.
web/      React SPA (Vite+TS+Tailwind), modular. Built dist/ served by backend.
android/  Compose app — DESIGN.md only, NOT implemented yet.
docs/specs/            3 design specs (core, web, app)
docs/plans/            5 implementation plans (server 1, 2, 3a, 3b, web 4)
docs/design-reference/ bondhu-html = the original Claude Design vanilla export (visual reference only; superseded by the React SPA)
.local/secrets.md      gitignored — API keys + test phone numbers (see there)
```

## Status
- [x] **server/** — Foundation+Auth, WhatsApp Core (Baileys), Rich Messaging, AI (translate/TTS/STT). **53 tests, tsc clean, live-verified.**
- [x] **web/** — React SPA: Login, ChatPage, LinkDevice (QR+pairing), Settings. Full **two-way translation + outgoing voice**. Rich messaging: reply, forward (dialog), edit, delete, reactions, image lightbox, per-message action menu. **Profile photos + saved contact names + profile view** (incl. `@lid` phone resolution). New-chat compose, account remove (sidebar ×). **Mic recording → transcribe (Gemini) → translated voice/text**. Perf: cached profile pics + lazy avatars. Mobile back nav.
- [ ] **android/** — design done (`android/DESIGN.md`), Compose NOT started. **Main remaining work.**
- [x] **Deploy** — LIVE at **https://wa.client-flow.xyz** (VPS `144.79.218.148`, pm2 `bondhu` port 3060, nginx + LE SSL). See `DEPLOY.md`. Update with `ssh root@144.79.218.148 'bash /opt/bondhu/deploy.sh'`. Old `whatsapp-mcp` stopped (code kept).
- WhatsApp account is linked (`nishatbd3388`, +8801767591988) and used for live verification; API keys are in the DB for that user.

## Run / build / test
```bash
# backend (serves API + built web SPA on http://localhost:3050)
cd "E:/New Whatsapp/server" && npm run dev          # tsx watch
cd "E:/New Whatsapp/server" && npm test             # vitest, 53 tests (ffmpeg-static used; transcode test runs)
# web SPA — rebuild after any web/src change so backend serves it
cd "E:/New Whatsapp/web" && npm run build           # -> web/dist
cd "E:/New Whatsapp/web" && npm run dev              # hot reload on :5173, proxies /api to :3050
```
- DB file `server/bondhu.db` is gitignored and contains live WhatsApp creds; delete it for a clean slate. After editing server files, tsx watch restarts; if it hits `EADDRINUSE` on :3050, kill the stale node via PowerShell `Get-NetTCPConnection -LocalPort 3050 | Stop-Process` then restart.

## Architecture quick map (backend)
- `db/` SQLite (better-sqlite3, WAL). Tables: users, accounts, auth_state, chats, messages, reactions, api_keys, user_lang, chat_lang, translations, tts_cache, **profile_pics** (cached avatar bytes), **contacts** (saved names). Schema runs statement-by-statement so idempotent `ALTER TABLE ADD COLUMN` is tolerated.
- `whatsapp/` `WaConnection` (1 Baileys socket/account) → `AccountManager` (owns sockets, persists events, re-emits). `auth-state.ts` = SQLite Baileys auth. `transcode.ts` = ffmpeg (via **ffmpeg-static**) WAV→OGG/Opus.
- `ai/` `KeyRing` (rotates keys on 429/5xx/**403**), `TranslationService` (Gemini), `TtsService` (**Gemini Developer API** TTS → WAV), `TranscriptionService` (**Gemini** audio→text, not Google STT), `langs.ts` (18 langs + flags).
- `api/` Express routes + `socket-gateway.ts` (per-user rooms; auto-translates incoming text before relay when the user has a key).

## Hard-won gotchas (do not relearn these)
1. **Baileys 7.x** uses **named ESM imports**: `import makeWASocket, { initAuthCreds, BufferJSON, proto, downloadMediaMessage, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'`. Default import is `makeWASocket` only; `pkg.initAuthCreds` is undefined. `printQRInTerminal` removed.
2. **Account id stays stable** (`account-<uuid>`). On the `phone` event we only `setPhone` (a column) — we DO NOT rename the id. Renaming mid-connection raced the auth_state migration and stalled reconnects in `authenticating`.
3. **History sync** comes via Baileys `messaging-history.set` (NOT messages.upsert). Handle it; mark those messages `isHistory` so unread isn't inflated. `chats.touch` only advances last_message_at/preview when the new timestamp is newer (out-of-order safe).
4. **Multi-key rotation on 403**: a Google API key restricted to certain services returns 403 `API_KEY_SERVICE_BLOCKED`. KeyRing rotates on 403 so adding BOTH the user's keys works (one does Gemini, the other TTS/STT). Either single unrestricted key also works.
5. **Pairing code** is exposed in `/api/status` (`pairingCode`) and via the `pairing` socket event. WhatsApp allows max **4 linked devices** per number — repeated test pairings exhaust slots; remove old "Bondhu" devices from the phone or use another number.
6. **sharp** in `/api/send-image` needs a real decodable image (tests use a 1×1 PNG base64).
7. Web `MessageBubble` media `<img>` uses `/api/media/:msgId?account=&token=` (JWT in query — the media route accepts `?token=`).
8. **Voice = Gemini TTS, NOT Cloud TTS.** `generativelanguage…/models/gemini-3.1-flash-tts-preview:generateContent` (voice "Achernar"), same key as translation. Cloud TTS's Gemini-TTS routes through **Vertex AI which rejects API keys** (`aiplatform.endpoints.predict denied`); the Developer API doesn't. Returns L16 PCM → wrap in WAV.
9. **ffmpeg is bundled via `ffmpeg-static`** (`transcode.ts` defaults to its path; `FFMPEG_PATH` env overrides). Voice notes need OGG/Opus, so `wavToOpus` transcodes. Do NOT rely on system-PATH ffmpeg (was a recurring "spawn ffmpeg ENOENT" source).
10. **Transcription = Gemini, NOT Google STT.** Google STT returns garbage for Bengali ("For."); Gemini (`gemini-2.5-flash` generateContent + audio inlineData) is accurate and uses the primary Gemini key. `/transcribe` transcodes the browser **webm→ogg** first. Flow: record (any lang) → transcript in box → send translates to the chosen target (e.g. Bangla voice → English to clients).
11. **Dedupe sent messages.** WhatsApp echoes our own sent messages back via `messages.upsert`; web `ChatView` dedupes by msgId and the optimistic bubble adopts the real id, so text doesn't double.
12. **Profile pics cached** (`profile_pics`, 24h hit / 6h negative) + `loading="lazy"` avatars + 6s timeout on `profilePictureUrl` — else the chat list fires one slow Baileys call per row. Avatar shows initials behind the photo (never black). Own sent voice isn't downloadable from WhatsApp → `/send-voice` stores its TTS audio (by real msgId) and `/media` serves it for replay.
13. **Contact names** from `messaging-history.set`/`contacts.upsert` → `contacts` table; chat list `COALESCE`s saved name over pushName. `@lid` privacy jids have no phone — resolved via Baileys lid mapping in `/profile`.
14. **`normalize` must NOT skip on a bare `content.messageContextInfo`.** Modern WhatsApp (multi-device / `@lid`) attaches `messageContextInfo` (deviceListMetadata) to ORDINARY incoming texts — skipping on its mere presence silently drops EVERY incoming message (outgoing still works because it's stored directly via `storeOutgoing`, not `normalize`). Only skip when it's the sole field. Symptom: "can send but receive nothing." Debug trick: log `messages.upsert` in wa-connection — if `[RX] ... keys=[messageContextInfo+conversation]` arrives but isn't stored, it's a normalize drop, NOT a session/re-link issue.
15. **Realtime needs re-sync on (re)connect.** socket.io doesn't replay events missed while disconnected (server restart / blip), so ChatPage/ChatView refetch on the socket `connect` event. The socket auth token is in the handshake (`auth.token`); same-origin (`io('/')`), Vite dev proxies `/socket.io` (ws:true).
16. **One contact must be ONE chat — canonicalize phone → `@lid`.** WhatsApp addresses the same person by both a privacy `@lid` and their phone jid, which split a contact into two chats (outgoing under phone, incoming under `@lid`). `WaConnection.canonicalJid` maps phone → `@lid` via `signalRepository.lidMapping.getLIDForPN` at **ingest** (`messages.upsert`) and on **every send** (`sendText`/`reply`/`sendImage`/`sendVoice` in account-manager). Direction matters: `getLIDForPN(bare phone)` resolves reliably, but the reverse `getPNForLID(@lid)` returns a **device-suffixed** `…:0@s.whatsapp.net` that does NOT match bare phone chats — that mismatch was the original split. `@lid`/`@g.us` pass through. Repair legacy splits with `POST /merge-lid-chats` (uses `ChatsRepo.mergeChat`, which also moves chat_lang + contact name and recomputes unread). **Auto-heal:** a brand-new typed number is sent before its lid is known (lands on a phone chat); when the reply arrives as `@lid`, the manager's `message` handler folds the sibling phone chat into it automatically (`mergeChat`, live messages only). One-off repair runner: `server/scripts/merge-lid-chats.mjs`.

## Conventions (how we work here)
- Backend: **TDD** (test → fail → impl → pass → commit), one commit per plan task.
- Frontend: vanilla-free **React SPA**, modular components, browser-verified (no unit harness). Build before claiming it works.
- Each plan executes on its own branch, then **merge to master + `git push origin master`**.
- Commit author: `nishatbd3388 <nishatbd3388@gmail.com>`; end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Plans live in `docs/plans/`; write a plan before a multi-step build, follow superpowers skills (writing-plans → executing-plans → finishing-a-development-branch).
- **Never commit secrets.** API keys live in Settings UI / DB only, and in `.local/secrets.md` (gitignored) for testing.

## Key product features built
- Multi-account link (QR + pairing code), 1300+ chat history sync, send/receive.
- Rich messaging: image (+lightbox), voice (player w/ duration+seek), reactions, reply, forward (dialog), edit, delete, read receipts, profile photos, saved contact names, profile view.
- **AI two-way translation:** incoming auto-translate to user's lang; **outgoing** translate before send (composer text/voice **mode toggle** + per-chat language, returns `sentText`+`original`).
- **Voice:** outgoing Gemini-TTS voice notes (mode toggle); own-voice replay; **mic recording → Gemini transcribe → translated voice/text** (key use case: Bangla speech → English to US clients).
- Composer: send-mode toggle (flag + Aa/🎙️), language picker (flags), mic record. Sidebar: account remove, new-chat compose. Per-user keys w/ rotation, 18 languages.

## Next steps (in priority order)
1. **Android app** — implement `android/DESIGN.md` in Kotlin/Compose against the same backend API (MVVM + Hilt + Retrofit + Socket.IO + ExoPlayer). Biggest remaining piece.
2. **Deploy** Bondhu to the VPS (build server + web, pm2, nginx) when ready.
3. Web polish as needed (per-chat language dialog, group handling, search).

## User context
- Replies in **Bengali/Banglish**; wants concise, result-first answers.
- Email nishatbd3388@gmail.com. Has Google Drive/Sheets helper at `C:\Users\nisha\OneDrive\Desktop\sofian\gsheet_api.py` (see global ~/.claude/CLAUDE.md) — unrelated to Bondhu.
- Has a Claude-in-Chrome browser (device "Nishath") + Claude Design account; the Bondhu web + android designs already exist there.
