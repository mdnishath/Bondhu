# WhatsApp Platform — Web UI Design (Fresh Rebuild)

**Date:** 2026-06-05
**Status:** Approved design
**Scope:** Web frontend only. Talks to the Core Backend (separate doc) via
REST + Socket.IO. Intended to be designed visually with Claude design first,
then wired up.

---

## 1. Purpose & Goals

A **full WhatsApp-Web-style chat client** in the browser. Not just a dashboard —
complete messaging: send/receive text, image, voice; translation + TTS display;
reactions, reply, forward, delete; read receipts; account management with QR /
pairing code; settings (API keys, languages).

**Design intent:** modern, clean, fast. Built with the stack Claude design
emits, so generated components drop straight in.

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix-based) |
| Icons | lucide-react |
| Data fetching | TanStack Query (REST) |
| Real-time | socket.io-client |
| Routing | React Router |
| State | Zustand (light global: active account, auth) + Query cache |
| Audio | Howler.js or native `<audio>` for voice/TTS |
| Forms | react-hook-form + zod |

---

## 3. Layout (responsive)

**Desktop (≥ md): three columns.**

```
┌────┬──────────────────┬───────────────────────────┐
│Rail│  Chat List       │  Chat View                │
│ 64 │  ~360px          │  flex-1                    │
│ px │  search + chats  │  header / messages / input│
└────┴──────────────────┴───────────────────────────┘
```

- **Rail (left, 64px):** account avatars (switch active account), unread dots,
  "+" add account, settings gear, logout. Active account highlighted.
- **Chat List column:** search bar, "new chat" button, scrollable chat rows.
- **Chat View column:** header (avatar, name, presence), message scroll area,
  composer.

**Mobile (< md): single column.** Chat list is the root; tapping a chat slides
in the Chat View (back button returns). Rail collapses into a top/side menu
(shadcn Sheet).

---

## 4. Routes

```
/login                 AuthScreen (login / register tabs)
/                      AppShell (requires auth)
  /                     → empty state ("select a chat")
  /chat/:accountId/:jid → ChatView
  /settings             → Settings (modal/route)
  /accounts             → Account manager (modal/route)
```

Auth guard: no JWT → redirect `/login`. JWT in localStorage; attached to REST
(Authorization header) and Socket.IO handshake.

---

## 5. Component Tree

```
AppShell
├── AccountRail
│     └── AccountAvatar*  AddAccountButton  SettingsButton
├── ChatListPanel
│     ├── SearchBar   NewChatButton
│     └── ChatRow*  (avatar, name, lastMsg, time, unreadBadge, ackTick)
└── ChatView
      ├── ChatHeader (avatar, name, presence, actions menu)
      ├── MessageList (virtualized)
      │     └── MessageBubble*
      │           ├── QuotedPreview?
      │           ├── MediaImage? | VoicePlayer? (waveform + play)
      │           ├── BodyText + TranslationSubText
      │           ├── TtsPlayButton
      │           ├── ReactionBadges?
      │           └── AckTicks (✓ / ✓✓ / blue ✓✓)
      └── Composer
            ├── TextInput (emoji)
            ├── VoiceRecordButton (hold/click → timer → send/cancel)
            ├── ImagePickButton (→ preview + caption modal)
            ├── LanguageToggle (per-chat target lang)
            └── SendButton

Modals/Sheets:
  PairAccountDialog (QR image + pairing-code input)
  ForwardPickerDialog (multi-select chats)
  ChatLanguageDialog (63-language picker)
  SettingsSheet (API keys CRUD, global language, theme)
  MessageActionMenu (reply / forward / react / delete / retranscribe)
```

`*` = list-rendered.

---

## 6. Key Screens / Flows

### 6.1 Auth
shadcn Card with Login / Register tabs. On success store JWT, connect socket,
route to `/`.

### 6.2 Account management & pairing
- `GET /api/accounts` lists accounts with status chips
  (connected / qr_pending / authenticating / disconnected).
- Add account → `PairAccountDialog`: choose **QR** (poll/socket for QR string →
  render via `qrcode` lib) or **pairing code** (enter phone → show 8-digit code).
- Live status via `status` / `account_status` socket events.

### 6.3 Chat list
- `GET /api/chats` (paginated, infinite scroll). Rows show avatar (lazy
  `GET /api/profile-pic`), name, last-message preview, time, unread badge, and
  own-message ack tick.
- Search filters locally + `GET /api/contacts?q=` for new people.
- `chat_update` socket event re-orders / updates unread live.

### 6.4 Chat view
- `GET /api/messages/:chatId?before=` with reverse-infinite scroll (load older
  on scroll-up). On open, mark read (`mark-read`) and the backend auto-translates
  3 newest.
- `MessageBubble` shows original + translation sub-text, TTS play
  (`GET /api/tts-audio/:msgId`), media (`GET /api/media/:msgId`), reactions,
  quoted bar, ack ticks.
- Live append on `message`; ack ticks update on `message_ack`; reactions on
  `message_reaction`.

### 6.5 Composer
- **Text:** `POST /api/send` (optional per-chat language, `raw` toggle to skip
  translation).
- **Voice (recorded):** MediaRecorder → webm/ogg → base64 →
  `POST /api/send-recorded`. Live timer, cancel/send.
- **Voice (text→speech):** type + pick language → `POST /api/send-voice`.
- **Image:** file/drag → preview + caption → compress client-side (optional) →
  `POST /api/send-image`.

### 6.6 Message actions
Hover/▾ menu or right-click → reply (sets quoted state), forward
(`ForwardPickerDialog` → `POST /api/forward`), react
(emoji popover → `POST /api/react`), delete (for-me / for-everyone →
`POST /api/delete-message`), retranscribe (`POST /api/retranscribe`).

### 6.7 Settings
- **API keys:** list (masked), add, activate, delete.
- **Language:** global default + per-chat overrides; 63-language searchable
  picker.
- **Theme:** light / dark / system.

---

## 7. Real-time Layer

Single Socket.IO connection (JWT handshake). A `useSocket` hook dispatches events
into the TanStack Query cache:
- `message` → append to message list + bump chat row.
- `message_ack` → patch ack on the message.
- `message_reaction` → patch reactions.
- `chat_update` → update chat list ordering/unread.
- `status` / `account_status` → update account chips / pairing dialog.
- `queue_status` → optional translation-progress indicator.

---

## 8. Design System

- **Tokens (Tailwind):** WhatsApp-inspired but modern — primary teal/green,
  neutral grays, soft message-bubble surfaces (own = green-tint, other =
  white/dark), rounded-2xl bubbles, subtle shadows.
- **Dark mode** first-class (`class` strategy).
- **Typography:** Inter (UI), system fallback; Bengali-capable font for
  translations (e.g., Noto Sans Bengali).
- **shadcn components:** Dialog, Sheet, ScrollArea, Avatar, DropdownMenu,
  Tabs, Popover, Tooltip, Badge, Input, Button, Skeleton (loading), Sonner
  (toasts).
- **Motion:** Framer Motion for chat slide-in (mobile), message enter,
  reaction pop.
- **Accessibility:** keyboard send (Enter), focus rings, ARIA on actions.

---

## 9. Project Structure

```
web/
  src/
    main.tsx  App.tsx  router.tsx
    lib/ api.ts  socket.ts  queryClient.ts  auth.ts
    store/ useAuth.ts  useActiveAccount.ts
    hooks/ useChats.ts  useMessages.ts  useSocket.ts  useAccounts.ts
    components/
      shell/ AppShell  AccountRail
      chatlist/ ChatListPanel  ChatRow  SearchBar
      chat/ ChatView  ChatHeader  MessageList  MessageBubble
            Composer  VoicePlayer  TtsPlayButton
      dialogs/ PairAccountDialog  ForwardPickerDialog
               ChatLanguageDialog  SettingsSheet
      ui/  (shadcn generated)
    pages/ Login.tsx
    styles/ index.css (tailwind)
  index.html  vite.config.ts  tailwind.config.ts
```

---

## 10. Build Phasing

1. **P1:** scaffold (Vite+TS+Tailwind+shadcn), auth, AppShell, routing, socket
   skeleton.
2. **P2:** account rail + pairing dialog (QR + code), live status.
3. **P3:** chat list (infinite scroll, search, live updates).
4. **P4:** chat view + message bubbles + send text + real-time append/ack.
5. **P5:** rich messaging (image, voice record, TTS, reactions, reply, forward,
   delete).
6. **P6:** translation display, per-chat language, settings, dark mode, polish.

> **Design-first note:** Claude design produces the visual components for
> AppShell, ChatRow, MessageBubble, Composer, and the dialogs. This spec defines
> their structure, props, and data so generated UI maps cleanly onto the API.
```
