# Bondhu Android — v1 Design (vertical slice)

**Date:** 2026-06-07
**Status:** Approved
**Supersedes/extends:** `android/DESIGN.md` (reconciles it with the live backend
contract and scopes a shippable v1).
**Scope:** Native Android client (Kotlin + Compose) talking to the existing
Bondhu backend (REST + Socket.IO). This spec defines the **v1 vertical slice**:
the smallest end-to-end-working app (auth → accounts → pair → chat list → text
chat), plus the concrete API/socket contract and the deferred feature layers.

---

## 1. Decisions (reconciliation with backend reality)

`android/DESIGN.md` was drawn against mockups that diverge from the live server.
The following decisions resolve every gap; the app follows backend reality.

| # | Mockup said | Backend reality | Decision |
|---|---|---|---|
| 1 | Auth via **phone + SMS 6-digit code** | `POST /api/register {email,password,name}`, `POST /api/login {email,password}` → JWT. No SMS/OTP. | **Email + password login/register** (same as web SPA). No SMS auth in v1. |
| 2 | **FCM** background push | No device-token endpoint, no server push at all. | **Foreground-only real-time (Socket.IO)** for v1. Background push deferred (would need new backend + Firebase). |
| 3 | socket events `account_status`, `queue_status` | Unified `status` event (carries qr/pairing/connected); events: `message`, `message_ack`, `chat_update`, `message_reaction`, `message_delete`, `message_edit`, `presence`. Every payload carries `accountId`. | Use the **real event names** below. |
| 4 | API keys = 3 named services (Translate/TTS/Gemini) | Generic Google key + free-text label, with rotation. | Settings shows **key list (masked) + add(label,key) + activate + delete**. |
| 5 | `POST /api/check-number` for new chat | No such endpoint. Web composes to `<digits>@s.whatsapp.net` and lets the server auto-heal the lid split. | New chat = type number → open chat with `<digits>@s.whatsapp.net`. |

**Identity:** package `com.bondhu.app`, app module `app`, repo path
`E:\New Whatsapp\android\`. (DESIGN.md's `com.whatsappmcp.app` is rebranded.)

**Base URL:** `BuildConfig.BASE_URL` — debug `http://10.0.2.2:3050`, release
`https://wa.client-flow.xyz`. Login screen exposes an editable "Server" field
(persisted to DataStore) so a physical device can point at the live server.

---

## 2. Tech stack (pinned to installed tooling)

Installed: Android Studio + bundled JBR (Java 17/21), SDK platforms 34/35/36,
build-tools 34/35/36, adb. Build with the project's `gradlew` using the JBR.

| Concern | Choice |
|---|---|
| Language / UI | Kotlin · Jetpack Compose · Material3 |
| Min / Target / Compile SDK | 26 / 35 / 35 |
| DI | Hilt |
| HTTP | Retrofit2 + OkHttp (logging interceptor in debug) |
| Real-time | `io.socket:socket.io-client` (Java) |
| Audio playback | Media3 ExoPlayer (deferred layer) |
| Audio record | MediaRecorder → OGG/Opus (deferred layer) |
| Images | Coil (Compose) |
| Storage | DataStore Preferences (JWT, active account, base URL, theme) |
| Nav | Navigation-Compose |
| Serialization | Moshi (Retrofit converter) |

---

## 3. Theme (from `theme.jsx`)

Dark-first Material3 scheme, exact tokens from the Claude design export:

```
primary   #00A884   primaryDk #008F72   appBg    #0B141A   surface  #111B21
header    #1F2C34   inBubble  #202C33    outBubble #005C4B  text     #E9EDEF
textMut   #8696A0   textFaint #667781    divider  rgba(134,150,160,.16)
tick      #53BDEB   badge     #00A884    field    #2A3942   danger   #F15C6D
```

- Bubbles: rounded; own = `outBubble`, other = `inBubble`; translation sub-text
  in `textMut`. Reaction badges = small chips (deferred layer).
- Typography: Material3 type scale; **Noto Sans Bengali** for Bengali glyphs.
- Avatars: deterministic color from name hash + initials (port `avColor`/
  `initials` from `theme.jsx`); Coil photo overlaid when `/profile-pic` returns.
- Shared atoms to port: `FilledButton`, `TextButton`, `Field`, `Chip`, `Sheet`
  (ModalBottomSheet), `FAB`, `TopBar`, `IconBtn`, `StatusChip`, `Avatar`.

---

## 4. API contract (v1 surface)

All under base `/api`. `requireAuth` routes need `Authorization: Bearer <jwt>`.
Account-scoped routes need `?account=<accountId>` (interceptor adds it from the
active account; media/profile-pic also accept `?token=` for image loaders).

**Auth (`auth.routes.ts`, mounted at `/api/auth` in server.ts)**
- `POST /api/auth/register {email,password,name}` → `{token, user:{id,email,name}}`
- `POST /api/auth/login {email,password}` → `{token, user}`
- `GET /api/auth/me` → `{id,email,name}`

**Accounts / connection (`whatsapp.routes.ts`)**
- `GET /accounts` → `{accounts:[{id,label,phone,status,qr}]}`
- `POST /accounts {label?}` → `{accountId}` (reuses a pending account; starts socket)
- `POST /accounts/:id/pair {phone}` → `{success}` (restart in pairing mode)
- `DELETE /accounts/:id` → `{success}`
- `GET /status?account=` → `{connected,state,phoneNumber,qr,pairingCode}`

**Chats / messages**
- `GET /chats?account=&limit=&offset=` → `{chats:[ChatRow]}`
- `GET /messages/:chatId?account=&limit=&before=` → `{lang, messages:[Msg]}`
  (each Msg includes `reactions`, `translated`, `transcript`, `senderName?`)
- `POST /send {account,chatId,message,translateTo?}` → `{success,msgId,sentText,original?}`
- `POST /chats/:chatId/mark-read {account}` → `{success}`
- `GET /profile-pic?account=&id=[&token=]` → image bytes (404 if none)
- `GET /profile?account=&id=` → `{jid,about,phoneJid,phone}`

**Deferred-layer routes** (referenced now so models are forward-compatible):
`/react`, `/reply`, `/forward`, `/edit-message`, `/delete-message`,
`/delete-local`, `/send-image`, `/send-recorded`, `/send-voice`, `/media/:msgId`,
`/transcribe`, `/retranscribe`, `/retranslate`, `/tts`, `/presence/*`,
`/settings/keys*`, `/settings/language`, `/chats/:chatId/language`,
`/chats/:chatId/clear`, `/merge-lid-chats`, `/backfill-contact-names`.

**Socket.IO** (same origin, handshake `auth.token = <jwt>`): server emits to a
per-user room. Events (each payload includes `accountId`):
- `status` `{status, qr?, code?, ...}` — `qr_pending` carries `qr`; `pairing`
  carries `code`; also `connected`/`authenticating`/`disconnected`.
- `message` `{...msg, translated?, transcript?, senderName?}`
- `message_ack` `{msgId, ack}`  ·  `chat_update` `{jid}`
- `message_reaction` `{msgId, emoji, sender}`
- `message_delete` `{msgId}`  ·  `message_edit` `{msgId, text}`
- `presence` `{jid, state}`

Socket.IO does **not** replay missed events, so screens **refetch on the socket
`connect` event** (mirrors the web client) to re-sync after reconnect.

---

## 5. Architecture (MVVM)

```
Compose UI ──state──> ViewModel (StateFlow) ──> Repository ──> ApiService (Retrofit)
     ▲                      ▲                                       │
     └─ collectAsState ─────┘                               Socket.IO events
                                   SocketManager ─emits─> Repository updates StateFlow
```

- **ViewModels (v1):** Auth, AccountList, Pair, ChatList, Chat.
- **Repositories (v1):** AuthRepository, AccountRepository, ChatRepository —
  merge REST results with live socket updates into `StateFlow`.
- **SocketManager (Hilt singleton):** one connection per logged-in session, JWT
  handshake, routes events into repositories. Reconnect → repositories trigger
  refetch. Connected only while the active account exists.
- **Interceptors:** `AuthInterceptor` (Bearer JWT from DataStore),
  `AccountInterceptor` (adds `?account=<activeAccountId>` to account-scoped GETs;
  POST bodies carry `account` explicitly via DTO).
- **Prefs (DataStore):** `jwt`, `activeAccountId`, `baseUrl`, `themeMode`.

---

## 6. Package structure

```
com.bondhu.app/
  App.kt (@HiltAndroidApp)   MainActivity.kt
  di/        NetworkModule  SocketModule  StoreModule
  data/
    api/        BondhuApi.kt   interceptors/AuthInterceptor  AccountInterceptor
    socket/     SocketManager.kt
    store/      Prefs.kt
    model/      dtos/ (AuthDto, AccountDto, ChatDto, MessageDto, StatusDto …)
                ui/   (Account, ChatRow, Message, ConnState …)
    repository/ AuthRepository  AccountRepository  ChatRepository
  ui/
    theme/      Color.kt  Type.kt  Theme.kt  Tokens.kt
    common/     AppScaffold  StatusChip  Avatar  EmptyState  LoadingShimmer
                ErrorBanner  BondhuButton  BondhuField  BondhuChip
    nav/        BondhuNavHost.kt  Routes.kt
    auth/       AuthScreen  AuthViewModel
    account/    AccountListScreen  PairScreen  AccountViewModel  PairViewModel
    chatlist/   ChatListScreen  ChatListViewModel  ChatRow
    chat/       ChatScreen  ChatViewModel  MessageBubble  Composer  AckTicks
```

Deferred layers add `ui/settings/`, `ui/chat/components/*` (VoiceBubble,
ImageBubble, TranslationText, TtsPlayButton, ReactionBadges, MessageActionSheet,
ForwardPickerSheet, ChatLanguageSheet, RecordOverlay), `data/audio/`.

---

## 7. Navigation

```
Splash(gate) ──jwt? & account?──> ChatList ──> Chat
              ──jwt only────────> AccountList ──> Pair
              ──no jwt──────────> Auth
Auth ──ok──> AccountList   AccountList ──select──> set active ──> ChatList
ChatList ──FAB──> NewChat(deferred)   ChatList ──> Settings(deferred)
```

JWT presence + active-account presence in DataStore choose the start
destination. Selecting an account sets `activeAccountId` and connects the socket.

---

## 8. Build phasing (v1 slice → layers)

**v1 vertical slice (this spec, ships first, verified on a real device):**
1. Scaffold + plumbing (Gradle, Hilt, Retrofit, Socket, theme, nav, DataStore,
   interceptors, BuildConfig base URL).
2. Auth (login/register, JWT store, nav gate, server-override field).
3. Accounts (list + status chips, add → Pair).
4. Pair (QR + pairing-code panes, live `status` → auto-advance to ChatList).
5. Chat list (paged `GET /chats`, avatars, preview/time/unread/ack, live
   `chat_update`+`message`, pull-refresh, FAB).
6. Chat — text only (reverse list, in/out bubbles + ack ticks, `POST /send`,
   live `message`+`message_ack`, `mark-read` on open, older-load on scroll).
7. SocketManager wiring + reconnect refetch across ChatList/Chat.

**Deferred layers (own spec/plan after slice verified):** voice
(record/play/own-replay), image (+lightbox), reactions, reply, forward, edit,
delete, read receipts, translation display + outgoing translate toggle +
per-chat language, TTS play, mic→transcribe→translated voice, Settings (keys/
language/theme), new-chat compose. Eventually: background notifications (FCM,
needs backend work).

---

## 9. Testing & verification

- **Build gate every task:** `./gradlew assembleDebug` clean (JBR java).
- **Unit (where cheap):** avatar color/initials, ack→tick mapping, DTO↔UI
  mappers, base-URL resolution — plain JUnit, no instrumentation.
- **Manual slice acceptance (real device, live server):** register/login →
  add account → scan QR / enter pairing code → reach Connected → see chat list
  populate → open a chat → send a text (arrives on the other phone) → receive a
  reply live → ack ticks update → reopen app stays logged in.

---

## 10. Out of scope for v1

SMS/OTP auth, FCM/background push, groups-specific UI beyond sender names,
search, archive/swipe actions, message search, multi-device presence polish,
any backend changes. These are explicitly deferred.
