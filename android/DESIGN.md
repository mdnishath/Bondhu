# WhatsApp Platform — Android App UI Design (Fresh Rebuild)

**Date:** 2026-06-05
**Status:** Approved design
**Scope:** Android app only. Talks to the Core Backend (separate doc) via
REST + Socket.IO, with FCM push. Native Kotlin + Jetpack Compose, modern
Material3 redesign of the existing functionality.

---

## 1. Purpose & Goals

A native Android client with a **refreshed, modern Material3 UI** that keeps full
feature parity: multi-account, real-time chat, voice record + TTS playback,
image, translation display, reactions, reply, forward, delete, read receipts,
per-chat language, FCM notifications.

Keep the proven existing architecture (MVVM + Hilt + Retrofit + Socket.IO +
ExoPlayer + Coil + DataStore) — **rebuild the UI layer**, not the plumbing.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose + Material3 |
| Min / Target SDK | 26 / 35 |
| DI | Hilt |
| HTTP | Retrofit2 + OkHttp |
| Real-time | socket.io-client (Java) |
| Audio playback | Media3 ExoPlayer |
| Audio record | MediaRecorder → OGG/Opus |
| Images | Coil |
| Storage | DataStore Preferences (JWT, active account, theme) |
| Push | Firebase Cloud Messaging |
| Nav | Navigation-Compose |

---

## 3. Navigation Graph

```
AuthScreen
   └─(login ok)─> AccountListScreen
                     └─(select)─> ChatListScreen
                                     ├─(chat)──> ChatScreen
                                     ├─────────> SettingsScreen
                                     └─────────> NewChatScreen (check-number)
   AccountListScreen ──> PairAccountScreen (QR / pairing code)
```

JWT in DataStore gates the start destination (Auth vs ChatList). Active account
id persisted; `?account=` added to requests by an interceptor.

---

## 4. Screens

### 4.1 AuthScreen
- Login / Register toggle. Material3 `OutlinedTextField`, gradient or clean
  surface header, primary button, error snackbar.
- On success: store JWT, register FCM token, connect socket, go to AccountList.

### 4.2 AccountListScreen
- List of linked accounts: avatar, label/phone, **status chip**
  (Connected / QR / Authenticating / Disconnected).
- FAB "Add account" → PairAccountScreen.
- Tap account → set active → ChatListScreen.
- Overflow: remove account, logout.

### 4.3 PairAccountScreen
- Two tabs: **QR** (render QR from `status` socket / `POST /api/accounts`) and
  **Pairing code** (enter phone → show 8-digit code → instructions).
- Live transition to Connected via `account_status` socket event.

### 4.4 ChatListScreen
- Material3 list: avatar (Coil, lazy `GET /api/profile-pic`), name, last-message
  preview, time, unread badge, own-message ack tick.
- Top app bar: account name + switch, search icon, settings.
- Pull-to-refresh; infinite scroll (paginated `GET /api/chats`).
- Swipe actions (mark read / archive optional). FAB → NewChatScreen.
- Live updates via `chat_update` / `message` socket events.

### 4.5 ChatScreen
- Top bar: back, avatar, name, presence (typing/online optional), overflow.
- **Message list** (LazyColumn, reverse): `MessageBubble`
  - own vs received styling; grouped timestamps; author name (groups).
  - `QuotedPreview` bar; image (Coil) / `VoiceBubble` (ExoPlayer + waveform/
    progress); body + **translation sub-text**; **TTS play** button
    (`GET /api/tts-audio/:msgId`); reaction badges; ack ticks (✓/✓✓/blue).
  - Reverse-infinite scroll loads older (`before=` cursor).
- **Composer (bottom):**
  - text field; **hold-to-record** mic (timer overlay, slide-to-cancel) →
    `POST /api/send-recorded`; image picker → preview+caption →
    `POST /api/send-image`; per-chat **language toggle**; send.
  - reply mode shows quoted bar above composer.
- **Long-press menu:** reply, forward, react (emoji row), delete (me/everyone),
  retranscribe, copy.
- On open: `mark-read`; backend auto-translates 3 newest.

### 4.6 NewChatScreen
- Phone input → `POST /api/check-number` → if on WhatsApp, open ChatScreen.
- Contact search `GET /api/contacts?q=`.

### 4.7 SettingsScreen
- **API keys:** list (masked), add (label + key), activate, delete.
- **Language:** global default + per-chat overrides; 63-language searchable list.
- **Account:** switch active, logout.
- **Appearance:** light / dark / system (Material3 dynamic color).

---

## 5. Component / Composable Inventory

```
common/  AppScaffold  StatusChip  Avatar  EmptyState  LoadingShimmer  ErrorBanner
auth/    AuthForm
account/ AccountRow  PairQrPane  PairCodePane
chatlist/ ChatRow  ChatListTopBar  SearchField
chat/    MessageBubble  QuotedPreview  VoiceBubble  ImageBubble
         TranslationText  TtsPlayButton  ReactionBadges  AckTicks
         Composer  RecordOverlay  ImageCaptionSheet  MessageActionSheet
         ForwardPickerSheet  ChatLanguageSheet
settings/ ApiKeyRow  LanguagePicker  ThemePicker
```

---

## 6. Architecture (MVVM)

```
UI (Compose)  ──state──>  ViewModel (StateFlow)  ──>  Repository  ──>  ApiService (Retrofit)
      ▲                         ▲                                          │
      └──── collectAsState ─────┘                                  Socket.IO events
                                                                          │
                                       SocketManager ── emits ───> Repository updates StateFlow
```

- **ViewModels:** Auth, AccountList, ChatList, Chat, Settings — expose
  `StateFlow<UiState>`; one-shot effects via `Channel`/`SharedFlow`.
- **Repositories:** ChatRepository (existing shape, extended), AccountRepository,
  SettingsRepository. They merge REST results with live socket updates.
- **SocketManager (singleton, Hilt):** one connection, JWT handshake, routes
  events into repositories. Foreground real-time; FCM covers background.
- **Interceptors:** Authorization (JWT) + active-account query param.

---

## 7. Real-time & Notifications

- **Foreground:** Socket.IO — `message`, `message_ack`, `message_reaction`,
  `chat_update`, `status`, `queue_status` → update StateFlow → UI recomposes.
- **Background:** FCM push (`FirebaseMessagingService`) → notification with
  sender + preview/translation; tap → deep-link to ChatScreen.
- Register/refresh FCM token on login and `onNewToken`.

---

## 8. Design System (Material3 refresh)

- **Color:** Material3 dynamic color (Android 12+) with a branded teal/green
  fallback scheme; dark theme first-class.
- **Bubbles:** rounded, own = primary-tinted, other = surface; translation in a
  subtle secondary text style; reaction badges as small chips.
- **Typography:** Material3 type scale; Bengali-capable font (Noto Sans Bengali)
  for translations.
- **Motion:** Compose animations — bubble enter, reaction pop, record overlay,
  list item placement.
- **Components:** Material3 `Scaffold`, `TopAppBar`, `NavigationBar` (if tabs),
  `ModalBottomSheet` (actions/forward/language), `FilterChip` (status),
  `Badge` (unread), `PullToRefresh`.
- **States:** shimmer skeletons (chat list / messages), empty states, error
  banners with retry.

---

## 9. Package Structure

```
com.whatsappmcp.app/
  di/                 (Hilt modules: network, socket, datastore)
  data/
    api/ MCPApiService.kt  interceptors/
    repository/ ChatRepository  AccountRepository  SettingsRepository
    socket/ SocketManager.kt
    audio/ VoiceRecorder.kt  AudioPlayer.kt
    model/ (dtos + ui models)
    store/ Prefs.kt (DataStore)
  ui/
    theme/ Color  Type  Theme
    auth/ AuthScreen  AuthViewModel
    account/ AccountListScreen  PairAccountScreen  AccountViewModel
    chatlist/ ChatListScreen  ChatListViewModel
    chat/ ChatScreen  ChatViewModel  components/*
    settings/ SettingsScreen  SettingsViewModel
    common/ (shared composables)
  push/ AppFirebaseMessagingService.kt
  MainActivity.kt  App.kt (@HiltAndroidApp)
```

---

## 10. Build Phasing

1. **P1:** theme + nav skeleton, Auth, DataStore JWT, Retrofit/Hilt wiring.
2. **P2:** AccountList + PairAccount (QR + code), status chips, SocketManager.
3. **P3:** ChatList (paging, refresh, search, live updates), FCM setup.
4. **P4:** ChatScreen text messaging + bubbles + real-time append/ack.
5. **P5:** voice record + ExoPlayer playback, image send, reactions, reply,
   forward, delete, read receipts.
6. **P6:** translation display, TTS play, per-chat language, settings, dark mode,
   animations, polish.

> **Design-first note:** Claude design provides the visual reference for
> MessageBubble, ChatRow, Composer, AccountRow, and the bottom sheets. This spec
> fixes their structure, state, and data bindings so the Compose implementation
> matches the API and the Web client's behavior.
```
