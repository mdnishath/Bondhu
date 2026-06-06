# New WhatsApp Platform — Fresh Rebuild

Multi-account WhatsApp client with translation, TTS, transcription — rebuilt
from scratch with **Baileys** (no Chrome/puppeteer), a native Android app, and a
full web chat client.

## Structure (everything separate)

```
New Whatsapp/
├── server/      → Core backend (Node + TypeScript + Baileys + SQLite)
│   └── DESIGN.md   ← core backend design/plan
├── web/         → Web chat client (React + Vite + Tailwind + shadcn/ui)
│   └── DESIGN.md   ← web UI design/plan
├── android/     → Android app (Kotlin + Jetpack Compose, Material3)
│   └── DESIGN.md   ← app UI design/plan
└── docs/
    └── specs/   → all 3 design docs together (reference copies)
```

Each part is independent and talks to the **same Core backend** over
REST + Socket.IO (app also uses FCM push).

## Key decisions

| Decision | Choice |
|---|---|
| WhatsApp engine | **Baileys** (WebSocket — no Chrome, ~50MB/account) |
| Database | **SQLite** (persistent chats/messages — new) |
| Mobile app | **Kotlin + Jetpack Compose** (native Android) |
| Web | **Full chat client** (React + Vite + Tailwind + shadcn) |
| Users | **Multi-user** (register/login, per-user accounts + API keys) |
| Features | **Full parity** (translate, TTS, transcribe, voice, image, reactions, forward, read receipts, 63 languages) |
| Connect | **QR code + pairing code** (8-digit, no scan needed) |

## Build order

1. **server/** first (everyone depends on it) — see `server/DESIGN.md`, phases P1–P5.
2. **web/** and **android/** in parallel — design the UI with Claude design using
   each `DESIGN.md` (component trees + structure are specified), then wire to the API.

## Running locally

```bash
# 1. Backend (API + WhatsApp + AI)
cd server && npm install && npm run build   # or: npm run dev
# 2. Web client (React SPA) — build once so the backend can serve it
cd ../web && npm install && npm run build
# 3. Start the server (serves the built web client + API on :3050)
cd ../server && npm run dev
# open http://localhost:3050
```
Web dev mode with hot reload: `cd web && npm run dev` (proxies /api to :3050).

## Status

- [x] Design specs written (Core, Web, App)
- [x] **server/** — Foundation+Auth, WhatsApp Core (Baileys), Rich Messaging, AI (translate/TTS/STT) — 48 tests, live-verified
- [x] **web/** — React SPA (Vite + TS + Tailwind), modular, wired to the API
- [ ] android/ — Compose implementation (design done)
