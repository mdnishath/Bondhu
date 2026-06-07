<div align="center">

# 🟢 Bondhu

**A self-hosted, multi-account WhatsApp client with real-time two-way translation.**

Type in Banglish/Bengali → your contact receives it in *their* language.
Their reply comes back translated into yours. Speak a voice note in one language →
it's sent as a voice note (and text) in another.

[![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Baileys](https://img.shields.io/badge/WhatsApp-Baileys%207-25D366?logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## What is Bondhu?

**Bondhu** (Bengali for *"friend"*) is an open-source WhatsApp web client you run on your
own server. It connects to WhatsApp through **[Baileys](https://github.com/WhiskeySockets/Baileys)**
(a WebSocket library — **no Chrome/Puppeteer**, ~50 MB RAM per account) and layers
**AI translation, text-to-speech, and speech-to-text** on top of normal messaging.

The core use case: **talk to people who don't share your language.** Write in your
own language; they read it in theirs. Record a voice note in Bengali; your US client
hears it in English. It all happens inline, per chat.

> ⚠️ **Unofficial client — read the [Disclaimer](#-disclaimer) before using.** Bondhu is not
> affiliated with WhatsApp/Meta and uses an unofficial library; there is a real risk of your
> number being banned. Use a number you can afford to lose.

---

## ✨ Features

### Messaging (full WhatsApp parity)
- 📱 **Multi-account** — link several WhatsApp numbers to one login
- 🔗 **Two link methods** — QR code **or** 8-digit pairing code (no scan needed)
- 🕘 **History sync** — pulls your existing chats & messages (1300+ tested)
- 💬 Send/receive text, **images** (with lightbox), **voice notes** (player w/ seek + duration)
- ↩️ **Reply**, ➡️ **forward**, ✏️ **edit**, 🗑️ **delete**, 😀 **reactions**, ✓✓ **read receipts**
- 👤 Profile photos, saved contact names, profile view (incl. modern `@lid` privacy IDs)
- 🟢 Presence (online / typing… / recording…), in-chat search, group sender names
- 🔄 Realtime over Socket.IO (auto re-syncs after reconnects)

### AI translation & voice (powered by Google Gemini)
- 🌐 **Two-way live translation** across **22 languages**
  - **Incoming** messages auto-translate into *your* language
  - **Outgoing** messages translate into the recipient's language *before* sending
- 🔁 **Per-chat language** + a composer **send-mode toggle** (text ↔ voice)
- 🗣️ **Outgoing voice notes** — your text is spoken aloud via Gemini TTS (+ the text)
- 🎙️ **Mic → transcribe → translate** — record a voice note, Gemini transcribes it, and it's
  sent as a translated voice note + text (e.g. *Bengali speech → English voice to your client*)
- 🔊 Tap-to-play translations and own-voice replay
- 🔑 **Per-user API keys with rotation** — add multiple Gemini keys; the KeyRing rotates on
  rate-limit/`403` so restricted keys still work together

---

## 🧱 Architecture

```
┌─────────────┐     REST + Socket.IO      ┌──────────────────────────────┐
│   web/      │ ◄───────────────────────► │            server/           │
│ React SPA   │                           │  Express · Socket.IO · SQLite│
└─────────────┘                           │  Baileys (WhatsApp socket)   │
┌─────────────┐                           │  Gemini: translate/TTS/STT   │
│  android/   │ ◄───────────────────────► │                              │
│ (planned)   │     REST + Socket.IO      └──────────────────────────────┘
└─────────────┘                                        │
                                              Google Gemini API
```

- **`server/`** — Node + TypeScript backend. Owns the Baileys sockets, persists everything to
  **SQLite** (`better-sqlite3`, WAL), exposes a REST API + Socket.IO gateway, and calls Gemini
  for translation / TTS / transcription. Serves the built web SPA in production.
- **`web/`** — React + Vite + Tailwind single-page chat client (the main UI).
- **`android/`** — native Kotlin/Compose app — **design only, not yet implemented** (see roadmap).

### Tech stack
| Layer | Tech |
|---|---|
| WhatsApp engine | Baileys 7 (WebSocket, no browser) |
| Backend | Node 20+, TypeScript, Express 4, Socket.IO 4 |
| Database | SQLite (better-sqlite3, WAL) |
| AI | Google **Gemini** — translation, TTS (`gemini-*-tts`), transcription (`gemini-2.5-flash`) |
| Audio | `ffmpeg-static` (WAV ↔ OGG/Opus), `sharp` (images) |
| Web | React 18, Vite 5, Tailwind 3 |
| Auth | JWT (per-user), bcrypt |

---

## 🚀 Quick start (local)

**Prerequisites:** Node.js **20+**, a free **Google Gemini API key**
([aistudio.google.com](https://aistudio.google.com/app/apikey)), and a WhatsApp account.

```bash
git clone https://github.com/mdnishath/Bondhu.git
cd Bondhu

# 1) Backend
cd server && npm install && npm run build

# 2) Web client (build once so the backend can serve it)
cd ../web && npm install && npm run build

# 3) Run the server (serves API + web on http://localhost:3050)
cd ../server && npm run dev
```

Open **http://localhost:3050**, then:
1. **Register / log in.**
2. **Settings → add your Gemini API key(s).** *(For one key to do everything, set its API
   restrictions to "Don't restrict key" in Google Cloud Console.)*
3. **Link a WhatsApp account** — scan the QR or use the phone-number pairing code.
4. Pick a per-chat language and start chatting. 🎉

> **Frontend hot-reload during development:** `cd web && npm run dev` (Vite on `:5173`,
> proxies `/api` and `/socket.io` to `:3050`).

### Configuration (env)
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3050` | HTTP/Socket.IO port |
| `DB_PATH` | `bondhu.db` | SQLite file path (relative to `server/`) |
| `FFMPEG_PATH` | bundled `ffmpeg-static` | Override the ffmpeg binary |

> API keys are **not** env vars — they're added per-user in the Settings UI and stored in the DB.

---

## ☁️ Deployment

A complete production runbook (VPS, pm2, nginx, Let's Encrypt SSL, one-command updates,
rollback) lives in **[DEPLOY.md](DEPLOY.md)**. Updating a live instance is one command:

```bash
ssh root@<server> 'bash /opt/bondhu/deploy.sh'   # git pull → build → pm2 reload
```

---

## 🗂️ Project structure

```
Bondhu/
├── server/         Node + TS backend (Baileys, SQLite, REST, Socket.IO, Gemini AI)
│   ├── src/        api · whatsapp · ai · db · services
│   └── scripts/    maintenance (copy-assets, chat-merge repair)
├── web/            React SPA (Vite + TS + Tailwind)
├── android/        Compose app — DESIGN.md only (not implemented)
├── docs/           specs + implementation plans + design reference
├── DEPLOY.md       production deployment & update runbook
└── deploy.sh       one-command VPS deploy
```

---

## 🧪 Testing

The backend follows **test-driven development** (≈**59** tests, Vitest):

```bash
cd server && npm test        # vitest run
npx tsc -b                   # type-check (clean)
```

---

## 🗺️ Roadmap

- [x] **Backend** — auth, WhatsApp core, rich messaging, AI (translate/TTS/STT)
- [x] **Web SPA** — full chat client with two-way translation & voice
- [x] **Deployment** — live on a VPS (nginx + SSL + pm2)
- [ ] **Android app** — Kotlin/Jetpack Compose (design done, build pending)
- [ ] Group-chat translation polish, message search across chats

---

## 🤝 Contributing

Contributions are welcome!

1. **Fork** the repo and create a branch: `git checkout -b feat/your-feature`
2. **Backend:** write a failing test first (TDD), implement, keep `npx tsc -b` clean.
   **Web:** build (`npm run build`) and verify in the browser before claiming it works.
3. Use clear, conventional commit messages (`feat:`, `fix:`, `docs:` …).
4. Open a **Pull Request** describing the change and how you verified it.

Please don't commit secrets — API keys live in the Settings UI / DB only.

---

## 📜 License

Released under the **[MIT License](LICENSE)** — free to use, modify, and distribute.
You must keep the copyright and license notice. Provided **as-is**, without warranty.

---

## ⚠️ Disclaimer

Bondhu is an **independent, unofficial** project. It is **not affiliated with, endorsed by,
or connected to WhatsApp LLC or Meta** in any way.

- It uses **Baileys**, an unofficial reverse-engineered WhatsApp library. Automating WhatsApp
  this way may violate WhatsApp's Terms of Service and **can result in your number being banned.**
- Use a number you are willing to lose. **You are solely responsible** for how you use this software.
- AI translation/transcription is sent to Google's Gemini API per your configured keys —
  review Google's terms and avoid sending data you must keep private.
- The authors accept **no liability** for bans, data loss, or any damages.

---

## 🙏 Acknowledgements

- [Baileys / WhiskeySockets](https://github.com/WhiskeySockets/Baileys) — the WhatsApp engine
- [Google Gemini](https://ai.google.dev) — translation, TTS, transcription
- Built with React, Vite, Tailwind, Express, Socket.IO, SQLite, and FFmpeg.
