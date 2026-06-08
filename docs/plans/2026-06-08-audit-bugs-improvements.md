# Audit Bugs & Improvements — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use `- [ ]` for tracking.
> Backend = TDD where a unit test is sensible. Frontend (web/android) = build-verify.
> Commit per task. Branch `fix/audit-bugs-improvements` → merge to master + push.

**Goal:** Fix every bug + close the feature gaps found in the full-project audit (server, web, android).

**Architecture:** Three independent subsystems. Do **Server first** (deploy fixes web+app at once), then **Web** (rebuild dist), then **Android** (rebuild APK, bump version). Shared backend means many user-facing fixes land for both clients via one deploy.

**Tech Stack:** Node+TS (Baileys, SQLite, Express, Socket.IO, Gemini) · React+Vite+TS+Tailwind · Kotlin/Compose (Hilt+Retrofit+Socket.IO+Media3).

---

## PART A — SERVER (`server/`)

### A1: IDOR — per-chat language routes need ownership check 🔒
**Files:** Modify `server/src/api/routes/ai.routes.ts:29-45`
- [ ] Route `GET/POST/DELETE /chats/:chatId/language` through the `account()` ownership helper (verify `accounts.isOwnedByUser`). Fix the helper to return `400 account required` when missing (not 403).
- [ ] Add/adjust a vitest that a foreign accountId is rejected.
- [ ] `npm test` green; commit.

### A2: `markRead` reads wrong row
**Files:** Modify `server/src/whatsapp/account-manager.ts:234`
- [ ] Fetch a window (limit 20) then `.find(!fromMe)`, or query latest non-fromMe in SQL.
- [ ] Commit.

### A3: Express error middleware + unguarded routes
**Files:** Modify `server/src/api/server.ts`, `server/src/index.ts`, `server/src/api/routes/whatsapp.routes.ts:237,298`
- [ ] Add terminal error middleware `(err,req,res,next)=>res.status(500)...`.
- [ ] Add `process.on('unhandledRejection')` + `uncaughtException` logging in `index.ts`.
- [ ] Wrap `/profile` and `/profile-pic` handlers in try/catch (or an asyncHandler wrapper).
- [ ] Commit.

### A4: Security hardening (CORS, rate-limit, body limit)
**Files:** Modify `server/src/api/server.ts`, `server/src/index.ts`, `server/package.json`
- [ ] CORS: allowlist `https://wa.client-flow.xyz` + localhost dev (HTTP + Socket.IO).
- [ ] Add `express-rate-limit`: tight limiter on `/api/auth/*`, moderate on AI routes (`/transcribe`,`/tts`,`/send-voice`).
- [ ] Lower global `express.json` limit to ~1mb; apply `50mb` only to media routes (`/send-image`, `/transcribe`, `/send-voice`).
- [ ] Commit.

### A5: WhatsApp robustness (backoff, listener leak, fetch timeout, forward canonicalize, key-ring net err)
**Files:** Modify `server/src/whatsapp/wa-connection.ts:46,126`, `server/src/whatsapp/account-manager.ts:193,301`, `server/src/ai/key-ring.ts:20`
- [ ] Reconnect: exponential backoff + jitter + cap; store timer handle, clear in `stop()`; skip reconnect on non-recoverable codes.
- [ ] On reconnect, `this.sock?.ev.removeAllListeners(); this.sock?.end()` before new socket.
- [ ] `profilePicBytes`: `fetch` with AbortController timeout (~6s).
- [ ] `forward`: canonicalize each target jid via `conn.canonicalJid`.
- [ ] `KeyRing`: also rotate/retry when error has no `status` (network err).
- [ ] Commit.

### A6: Message normalize — unwrap ephemeral/viewOnce; reaction fromMe on realtime
**Files:** Modify `server/src/whatsapp/normalize.ts:54`, `server/src/whatsapp/account-manager.ts:103-106`, `server/src/api/socket-gateway.ts:71`
- [ ] Unwrap `ephemeralMessage.message` / `viewOnceMessageV2(.V2Extension)?.message` before classifying so inner text isn't lost as `[message]`.
- [ ] Carry `fromMe` through the realtime reaction re-emit + socket gateway so client knows reaction owner; handle empty-emoji removal end-to-end.
- [ ] Commit.

---

## PART B — WEB (`web/`)

### B1: VoicePlayer captures stale `src`
**Files:** Modify `web/src/components/chat/MessageBubble.tsx:342`
- [ ] Recreate/reset audio when `src` prop changes (effect on `[src]`, set `audio.src`, reset playing/progress). Build.

### B2: Optimistic voice/image duplicate on echo
**Files:** Modify `web/src/components/chat/ChatView.tsx:93-107,206-283`
- [ ] In socket `message` handler, reconcile against pending `tmp` bubbles (match `fromMe` + body/ts) before appending; adopt real msgId. Ensure voice/image optimistic paths get the same guard. Build.

### B3: markRead visibility gate + ack NaN + Login nav + TTS audio cleanup
**Files:** `web/src/components/chat/ChatView.tsx:108,125`, `web/src/pages/Login.tsx:16`, `web/src/components/chat/MessageBubble.tsx:321`
- [ ] `markRead` only when `document.visibilityState==='visible'` and chat actually shown.
- [ ] `Math.max(m.ack ?? 0, e.ack)`.
- [ ] Login: use `<Navigate>` / `useEffect` instead of nav() in render.
- [ ] TTS speaker: single audio ref, stop prior, clear `busy` on `ended`.
- [ ] Build.

### B4: 401 handler disconnects socket
**Files:** `web/src/lib/api.ts:29`, `web/src/lib/socket.ts`
- [ ] Call `disconnectSocket()` in the 401 path before redirect. Build.

### B5: Web infinite older-message scroll
**Files:** `web/src/lib/api.ts:65`, `web/src/components/chat/ChatView.tsx:384`
- [ ] `messages()` accept `before` cursor; top-scroll handler fetches older page, prepends, preserves scroll position. Build.

### B6: Web perf — memo MessageBubble + multiline composer
**Files:** `web/src/components/chat/MessageBubble.tsx`, `web/src/components/chat/Composer.tsx:162`
- [ ] `React.memo(MessageBubble)`.
- [ ] Composer → auto-grow `<textarea>`, Enter sends, Shift+Enter newline. Build.

---

## PART C — ANDROID (`android/`)

### C1: Error snackbar + clearError
**Files:** `android/.../ui/chat/ChatScreen.kt:46`, `android/.../ui/chat/ChatViewModel.kt`
- [ ] Add `clearError()` to VM; `LaunchedEffect(s.error){ if!=null show snackbar; clearError() }`. Build.

### C2: Avatar/media URL race
**Files:** `android/.../ui/chat/ChatScreen.kt:85,228,276`, `android/.../ui/chatlist/ChatListScreen.kt:182`, `android/.../data/.../MediaUrlBuilder.kt`
- [ ] Derive media/avatar URLs from observed jwt/account state (collectAsState) so they recompute when prefs warm. Build.

### C3: Debounce chat-list refresh + account spinner flicker + auto-scroll key
**Files:** `android/.../ui/chatlist/ChatListViewModel.kt:41`, `android/.../ui/account/AccountViewModel.kt:34`, `android/.../ui/chat/ChatScreen.kt:49`
- [ ] Debounce/conflate list refresh (~1-2s) like ChatViewModel.
- [ ] Account list: separate "refreshing" flag; don't replace list with full spinner on every status event.
- [ ] Auto-scroll keyed on last message id (not size); only when near bottom. Build.

### C4: Reaction removal + socket reconnect on resume
**Files:** `android/.../ui/chat/ChatViewModel.kt:172`, `android/.../MainActivity.kt`, `android/.../data/socket/SocketManager.kt`
- [ ] Handle empty-emoji `message_reaction` as removal (clear badge); reconcile fromMe on echo.
- [ ] Observe process lifecycle; `socket.connect()` on ON_START. Build.

### C5: Edit-message UI (Android) ✨
**Files:** `android/.../data/api/BondhuApi.kt`, `android/.../data/repository/ChatRepository.kt`, `android/.../ui/chat/MessageActionSheet.kt`, `ChatViewModel.kt`, `Composer.kt`, `ChatScreen.kt`
- [ ] Add `editMessage` to API + repo (`POST /edit-message`).
- [ ] Add "Edit" action (own text msgs only) → composer edit-mode (prefill draft, banner, confirm) → call repo; optimistic update. Build.

### C6: Multi-target Forward (Android) ✨
**Files:** `android/.../ui/chat/ForwardSheet.kt:25`, `ChatViewModel.kt:320`
- [ ] Checkbox multi-select + confirm button; pass `List<String>` (repo already accepts). Build.

### C7: Infinite older-scroll (Android) ✨
**Files:** `android/.../ui/chat/ChatViewModel.kt:216`, `ChatRepository.kt:21`, `ChatScreen.kt`
- [ ] On scroll-to-top, fetch older page via `before=oldestTs`, prepend, keep position; loading indicator. Build.

### C8: Pull-to-refresh + image caption + theme toggle ✨
**Files:** `android/.../ui/chatlist/ChatListScreen.kt:146`, `android/.../ui/chat/Composer.kt:101`, `ChatViewModel.kt:342`, `android/.../Prefs.kt:26`, `MainActivity.kt:21`
- [ ] Chat list: Material3 `PullToRefreshBox`.
- [ ] Image: caption entry dialog before send (pass caption to `sendImage`).
- [ ] Theme toggle: read/write `Keys.THEME`, wire into theme; Settings switch. Build.

### C9: Final — bump version, build APK, unit tests
- [ ] Bump `versionCode`/`versionName` in `app/build.gradle.kts`.
- [ ] `:app:assembleDebug` + `:app:testDebugUnitTest`. Deliver APK path.

---

## Deploy / finish
- [ ] Server: `npm test` green → commit per task.
- [ ] Web: `npm run build` → dist committed.
- [ ] Merge branch → master, `git push origin master`.
- [ ] Deploy: `ssh root@144.79.218.148 'bash /opt/bondhu/deploy.sh'`.
- [ ] Android APK delivered to user (manual install).
- [ ] Update CLAUDE.md status + memory.
