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
- [x] **server/** — Plan 1 Foundation+Auth, Plan 2 WhatsApp Core (Baileys), Plan 3a Rich Messaging, Plan 3b AI (translate/TTS/STT). **48 tests, tsc clean, live-verified.**
- [x] **web/** — Plan 4 React SPA: Login, ChatPage (rail+list+chat+composer+bubbles), LinkDevice (QR+pairing), Settings (API keys+language). Two-way translation working.
- [ ] **android/** — design done (`android/DESIGN.md`), Compose implementation NOT started. **This is the main remaining work.**
- [ ] Deferred web polish: voice recording send, forward dialog, per-chat language dialog (per-chat OUTGOING lang already works via composer).
- [ ] Live full browser test still needs a WhatsApp account linked (blocked on device-limit — see secrets file).

## Run / build / test
```bash
# backend (serves API + built web SPA on http://localhost:3050)
cd "E:/New Whatsapp/server" && npm run dev          # tsx watch
cd "E:/New Whatsapp/server" && npm test             # vitest, 48 tests
# web SPA — rebuild after any web/src change so backend serves it
cd "E:/New Whatsapp/web" && npm run build           # -> web/dist
cd "E:/New Whatsapp/web" && npm run dev              # hot reload on :5173, proxies /api to :3050
```
- DB file `server/bondhu.db` is gitignored and contains live WhatsApp creds; delete it for a clean slate. After editing server files, tsx watch restarts; if it hits `EADDRINUSE` on :3050, kill the stale node via PowerShell `Get-NetTCPConnection -LocalPort 3050 | Stop-Process` then restart.

## Architecture quick map (backend)
- `db/` SQLite (better-sqlite3, WAL). Tables: users, accounts, auth_state, chats, messages, reactions, api_keys, user_lang, chat_lang, translations, tts_cache. Schema runs statement-by-statement so the idempotent `ALTER TABLE ADD COLUMN raw` is tolerated.
- `whatsapp/` `WaConnection` (1 Baileys socket/account) → `AccountManager` (owns sockets, persists events, re-emits) → `EventBridge` logic inside the manager. `auth-state.ts` = SQLite Baileys auth.
- `ai/` `KeyRing` (rotates keys on 429/5xx/**403**), `TranslationService` (Gemini; `translate` incoming cached, `translateOutgoing` not cached), `TtsService` (Google Cloud TTS), `TranscriptionService` (Google STT), `langs.ts`.
- `api/` Express routes + `socket-gateway.ts` (per-user rooms; auto-translates incoming text before relay when the user has a key).

## Hard-won gotchas (do not relearn these)
1. **Baileys 7.x** uses **named ESM imports**: `import makeWASocket, { initAuthCreds, BufferJSON, proto, downloadMediaMessage, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'`. Default import is `makeWASocket` only; `pkg.initAuthCreds` is undefined. `printQRInTerminal` removed.
2. **Account id stays stable** (`account-<uuid>`). On the `phone` event we only `setPhone` (a column) — we DO NOT rename the id. Renaming mid-connection raced the auth_state migration and stalled reconnects in `authenticating`.
3. **History sync** comes via Baileys `messaging-history.set` (NOT messages.upsert). Handle it; mark those messages `isHistory` so unread isn't inflated. `chats.touch` only advances last_message_at/preview when the new timestamp is newer (out-of-order safe).
4. **Multi-key rotation on 403**: a Google API key restricted to certain services returns 403 `API_KEY_SERVICE_BLOCKED`. KeyRing rotates on 403 so adding BOTH the user's keys works (one does Gemini, the other TTS/STT). Either single unrestricted key also works.
5. **Pairing code** is exposed in `/api/status` (`pairingCode`) and via the `pairing` socket event. WhatsApp allows max **4 linked devices** per number — repeated test pairings exhaust slots; remove old "Bondhu" devices from the phone or use another number.
6. **sharp** in `/api/send-image` needs a real decodable image (tests use a 1×1 PNG base64).
7. Web `MessageBubble` media `<img>` uses `/api/media/:msgId?account=&token=` (JWT in query — the media route accepts `?token=`).

## Conventions (how we work here)
- Backend: **TDD** (test → fail → impl → pass → commit), one commit per plan task.
- Frontend: vanilla-free **React SPA**, modular components, browser-verified (no unit harness). Build before claiming it works.
- Each plan executes on its own branch, then **merge to master + `git push origin master`**.
- Commit author: `nishatbd3388 <nishatbd3388@gmail.com>`; end commit messages with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Plans live in `docs/plans/`; write a plan before a multi-step build, follow superpowers skills (writing-plans → executing-plans → finishing-a-development-branch).
- **Never commit secrets.** API keys live in Settings UI / DB only, and in `.local/secrets.md` (gitignored) for testing.

## Key product features built
- Multi-account link (QR + pairing code), 1300+ chat history sync, send/receive.
- Rich: image, voice, reactions, reply, forward, delete, read receipts, profile pics.
- **AI two-way translation:** incoming auto-translate to user's lang; **outgoing** translate before send (composer "Send in <lang>" selector, per-chat persisted, returns `sentText`+`original`). TTS playback, voice transcription. Per-user keys with rotation, 18 languages.

## Next steps (in priority order)
1. **Android app** — implement `android/DESIGN.md` in Kotlin/Compose against the same backend API (MVVM + Hilt + Retrofit + Socket.IO + ExoPlayer). Biggest remaining piece.
2. **Live browser test** — link a WhatsApp account (needs a number with a free device slot) to see real chats + translation end-to-end.
3. Optional web polish: voice recording send, forward dialog.
4. **Deploy** Bondhu to the VPS (build server + web, pm2, nginx) when ready.

## User context
- Replies in **Bengali/Banglish**; wants concise, result-first answers.
- Email nishatbd3388@gmail.com. Has Google Drive/Sheets helper at `C:\Users\nisha\OneDrive\Desktop\sofian\gsheet_api.py` (see global ~/.claude/CLAUDE.md) — unrelated to Bondhu.
- Has a Claude-in-Chrome browser (device "Nishath") + Claude Design account; the Bondhu web + android designs already exist there.
