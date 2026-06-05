# WhatsApp Platform — Core Backend Design (Fresh Rebuild)

**Date:** 2026-06-05
**Status:** Approved design
**Scope:** Core server only. Web UI and App UI have separate design docs.

---

## 1. Purpose & Goals

Rebuild the WhatsApp automation platform's backend from scratch, replacing the
`whatsapp-web.js` (puppeteer/Chrome) engine with **Baileys** (raw WebSocket).

**Why rebuild:**
- The Chrome-per-account model leaks processes and exhausts VPS memory
  (observed: 61 Chrome processes, swap full, all accounts stuck in `qr_pending`).
- Baileys uses ~50 MB RAM per account vs ~200 MB+ for a headless Chrome, with
  no orphaned-process class of bug.

**Goals:**
- Full feature parity with the current system (multi-user, multi-account,
  translation, TTS, transcription, reactions, forward, voice, image, read
  receipts, profile pics, 63 languages).
- Persistent SQLite message/chat store (new — required by Baileys, big upgrade).
- Clean, well-bounded modules that are independently testable.
- Same external API surface so Web and App clients share one backend.

**Non-goals (v1):** Official Meta Cloud API, MCP tools (can be re-added later),
group admin operations beyond messaging.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 20+ / TypeScript |
| WhatsApp engine | **@whiskeysockets/baileys** (latest) |
| HTTP server | Express 4 |
| Real-time | Socket.IO 4 |
| Database | better-sqlite3 (WAL mode) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Translation | Google Gemini 2.5 Flash |
| TTS | Google Cloud TTS (Chirp3-HD) + Gemini TTS fallback |
| Transcription | Google Cloud Speech-to-Text |
| Push | firebase-admin (FCM) |
| Image | sharp |
| Audio | ffmpeg-static (OGG/Opus for voice notes) |
| Validation | zod |
| Process mgr | pm2 (prod) |

---

## 3. Architecture Layers

```
┌───────────────────────────────────────────────────────────┐
│ Clients: Web (React) · Android (Compose)                  │
└───────────────┬───────────────────────────┬───────────────┘
                │ REST (JWT)                 │ Socket.IO (JWT)
┌───────────────▼───────────────────────────▼───────────────┐
│ API Layer (Express routes + Socket.IO gateway)            │
├───────────────────────────────────────────────────────────┤
│ Service Layer                                             │
│   AccountService · MessageService · AuthService           │
│   TranslationService · TtsService · TranscriptionService  │
│   KeyRotationService · RetryQueue · PushService (FCM)     │
├───────────────────────────────────────────────────────────┤
│ WhatsApp Layer                                            │
│   AccountManager → WaConnection (1 per account)           │
│   EventBridge (Baileys events → normalized domain events) │
├───────────────────────────────────────────────────────────┤
│ Data Layer (better-sqlite3)                               │
│   users · accounts · chats · messages · reactions ·       │
│   receipts · auth_state · api_keys · chat_lang ·          │
│   fcm_tokens · settings                                   │
└───────────────────────────────────────────────────────────┘
```

Each module has one purpose and a typed interface. The WhatsApp Layer never
touches HTTP; the API Layer never calls Baileys directly — everything goes
through Services.

---

## 4. Baileys Integration (the critical part)

Baileys is event-driven and stateless about history. We own the state.

### 4.1 Connection (`WaConnection`)
- One `makeWASocket()` per account.
- `printQRInTerminal: false`; we capture the QR string and emit it.
- **Pairing code support:** if the user supplies a phone number, call
  `sock.requestPairingCode(number)` → returns an 8-digit code the user types
  into WhatsApp (no QR scan needed). Both QR and pairing flows supported.
- Reconnect on `connection.close` with backoff, EXCEPT when the disconnect
  reason is `loggedOut` (`DisconnectReason.loggedOut`) — then clear auth state
  and require re-pair.
- Backoff: 1s → 2s → 5s → 10s → 30s cap (much faster than Chrome restart).

### 4.2 Auth State (`auth_state` table)
- Use a **SQLite-backed auth state** adapter (port of `useMultiFileAuthState`
  to DB rows keyed by `(account_id, key)`), so credentials survive restarts and
  there is no `.wwebjs_auth` folder sprawl.
- Each account's creds + signal keys are small JSON blobs.

### 4.3 EventBridge — Baileys events → domain events
| Baileys event | Action |
|---|---|
| `connection.update` | update status; capture QR; handle reconnect/loggedOut |
| `creds.update` | persist auth state to DB |
| `messages.upsert` | normalize → store in `messages` → emit `message`; queue AI |
| `messages.update` | edits / status (delivery/read) → update `receipts` |
| `message-receipt.update` | read receipts (✓✓ blue) |
| `messages.reaction` | upsert `reactions` → emit `message_reaction` |
| `chats.upsert` / `chats.update` | maintain `chats` table |
| `contacts.upsert` | cache contact names/avatars |
| `presence.update` | online/typing (optional, emit to clients) |

### 4.4 Normalization
Baileys message shape (`proto.IWebMessageInfo`) is converted to our domain
`Message` model (see §5) — flattening `key.id`, `key.remoteJid`, `key.fromMe`,
message-type union (conversation / extendedText / image / audio(ptt) / etc.),
quoted context (`contextInfo.quotedMessage`), and media metadata. Media is
downloaded on demand via `downloadMediaMessage()`.

### 4.5 Outgoing operations (`MessageService`)
- `sendText(jid, text, quoted?)`
- `sendImage(jid, buffer, caption?)` — sharp-compressed
- `sendVoice(jid, oggOpusBuffer, quoted?)` — `ptt: true`
- `sendReaction(key, emoji)`
- `forward(messageKeys, targetJids)`
- `deleteMessage(key, forEveryone)`
- `markRead(jid, keys)` → `sock.readMessages()`
- `checkNumber(phone)` → `sock.onWhatsApp()`

---

## 5. Data Model (SQLite)

```sql
users(id, email UNIQUE, password_hash, name, created_at)

accounts(id, user_id, label, phone, status, created_at)
-- id starts as account-<uuid>, renamed to phone once known

auth_state(account_id, key, value, PRIMARY KEY(account_id, key))

chats(account_id, jid, name, is_group, last_message_at, unread_count,
      pinned, archived, avatar_url, avatar_fetched_at,
      PRIMARY KEY(account_id, jid))

messages(account_id, msg_id, chat_jid, sender_jid, from_me, type,
         body, caption, media_path, media_mime, quoted_msg_id,
         timestamp, ack, deleted, INDEX(account_id, chat_jid, timestamp))

reactions(account_id, msg_id, sender_jid, emoji, from_me,
          PRIMARY KEY(account_id, msg_id, sender_jid))

receipts(account_id, msg_id, status)  -- 0..4 (pending..played)

translations(account_id, msg_id, lang, text, created_at,
             PRIMARY KEY(account_id, msg_id, lang))

tts_cache(account_id, msg_id, lang, path, created_at,
          PRIMARY KEY(account_id, msg_id, lang))

api_keys(id, user_id, key_value, label, is_active, created_at)

chat_lang(user_id, account_id, chat_jid, lang,
          PRIMARY KEY(user_id, account_id, chat_jid))

user_lang(user_id, lang)  -- global default target language

fcm_tokens(token, user_id, created_at)

settings(key, value)  -- e.g. jwt_secret
```

**Key change vs old system:** messages/chats now persist in SQLite instead of
being fetched live from a browser. Pagination and history become fast and
reliable. Translation/TTS caches move from loose JSON files into DB tables
(with retention cleanup job).

---

## 6. REST API

Auth via `Authorization: Bearer <jwt>` (or `?token=` for media URLs). All
data routes are user-scoped; `?account=<id>` selects the active account.

**Auth:** `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`

**Accounts:** `GET /api/accounts` · `POST /api/accounts` (returns QR or accepts
`{phone}` for pairing code) · `DELETE /api/accounts/:id` ·
`POST /api/accounts/:id/pair` (`{phone}` → pairing code) ·
`GET /api/status?account=`

**Chats/Messages:**
`GET /api/chats?limit&offset&account` ·
`GET /api/messages/:chatId?limit&before&account` ·
`POST /api/send` · `POST /api/send-voice` (text→TTS→ptt) ·
`POST /api/send-recorded` (audio base64→ptt) · `POST /api/send-image` ·
`POST /api/delete-message` · `POST /api/forward` · `POST /api/react` ·
`POST /api/reply` · `POST /api/chats/:chatId/mark-read`

**Media/AI:**
`GET /api/media/:msgId` · `GET /api/tts-audio/:msgId` ·
`POST /api/translate` · `POST /api/tts` · `POST /api/retranscribe` ·
`POST /api/retranslate` · `GET /api/profile-pic?id=`

**Contacts:** `GET /api/contacts?q=` · `POST /api/check-number`

**Settings:** `GET/POST /api/settings/keys` · `DELETE /api/settings/keys/:id` ·
`POST /api/settings/keys/:id/activate` ·
`GET/POST /api/settings/language` ·
`GET/POST /api/chats/:chatId/language`

**FCM:** `POST /api/fcm/register` · `POST /api/fcm/unregister`

> The endpoint shapes intentionally match the current system so existing client
> code is a near drop-in; internals are rewritten.

---

## 7. Socket.IO Events (server → client)

`status` (account state + QR/pairing) · `message` (new incoming/outgoing) ·
`message_ack` (delivery/read) · `message_reaction` · `chat_update`
(unread/last-msg) · `account_status` · `queue_status` (retry progress) ·
`presence` (typing/online, optional).

Socket handshake carries the JWT; the server joins the socket to a per-user
room so events fan out only to that user's clients.

---

## 8. AI Services

- **TranslationService:** Gemini 2.5 Flash. Cache by `(msg_id, lang)`. Returns
  placeholder `[⏳ অনুবাদ হচ্ছে...]` on failure; RetryQueue retries.
- **TtsService:** Google Cloud TTS (Chirp3-HD, region voice map) primary; Gemini
  TTS fallback on quota. Cache by `(msg_id, lang)` → file path.
- **TranscriptionService:** Google Cloud Speech-to-Text for incoming voice
  notes; output feeds translation.
- **KeyRotationService:** per-user API keys (DB); rotate on 429/5xx; auto-promote
  next active key.
- **RetryQueue:** DB-backed (replaces `.retry-queue.json`). Batch of 5 every
  15s, max 40 retries / 2h, then mark `[অনুবাদ ব্যর্থ - Retry korun]`. Emits
  `queue_status`.
- **Auto-translate-on-open:** when a chat is opened, translate the 3 newest
  uncached messages (client triggers via `GET /api/messages`).

---

## 9. Auth, Multi-User, Multi-Account

- JWT 30-day, secret in `settings`. bcrypt (10 rounds), 6-char min password.
- Every account row has `user_id`; all queries filter by it. A user can link
  many accounts; first is default.
- Account id lifecycle: `account-<uuid>` → renamed to `phone` on
  `connection.update` once `sock.user.id` is known (update FK rows + caches in a
  transaction).

---

## 10. FCM Push

- `firebase-service-account.json` (local, gitignored).
- On incoming `message` (and optionally reaction), look up the owning user's FCM
  tokens and push (title = sender, body = preview/translation).
- Token registered/unregistered via API; one token ↔ one user.

---

## 11. Project Structure

```
server/
  src/
    index.ts                 # bootstrap: db, accounts, http, sockets
    config.ts
    db/
      schema.sql  migrate.ts  db.ts
      repositories/           # users, accounts, chats, messages, ...
    whatsapp/
      account-manager.ts  wa-connection.ts  event-bridge.ts
      auth-state.ts        normalize.ts      media.ts
    services/
      auth.service.ts  account.service.ts  message.service.ts
      translation.service.ts  tts.service.ts  transcription.service.ts
      key-rotation.service.ts  retry-queue.ts  push.service.ts
    api/
      routes/*.ts  middleware/auth.ts  socket-gateway.ts
    util/  (lang map, audio convert, jid helpers)
  package.json  tsconfig.json
```

---

## 12. Migration Notes (from whatsapp-web.js)

- No `.wwebjs_auth` folders; auth lives in `auth_state` table → re-pair all
  accounts once (QR or pairing code) on first run of the new server.
- Loose JSON caches (`.translation-cache-*`, `.tts-cache-*`, `.pic-cache-*`,
  `.reactions-cache-*`, `.deleted-msgs-*`, `.retry-queue.json`) are superseded
  by DB tables. Optional one-time import script if old data must be preserved.
- ack levels keep the same 0..4 meaning so client UI is unchanged.

---

## 13. Build Phasing

1. **P1 Foundation:** DB + schema, auth (register/login/JWT), Express+Socket.IO
   skeleton, config.
2. **P2 WhatsApp core:** Baileys connection, auth-state adapter, QR + pairing,
   EventBridge, chats/messages store, send text, real-time `message`/`status`.
3. **P3 Rich messaging:** image, voice (record + TTS), reactions, reply, forward,
   delete, read receipts, profile pics, contacts, check-number.
4. **P4 AI:** translation, TTS, transcription, key rotation, retry queue,
   per-chat language.
5. **P5 Push & polish:** FCM, cache cleanup jobs, pm2/deploy, hardening.

---

## 14. Testing Strategy

- Unit: normalize.ts (message shapes), jid helpers, lang map, key rotation,
  retry-queue state machine — pure functions, fully tested.
- Integration: repositories against a temp SQLite; API routes via supertest with
  a mocked WhatsApp Layer.
- Manual/e2e: one real account paired in dev, scripted send/receive smoke test.
- WhatsApp Layer is mocked behind an interface so services test without a live
  socket.
```
