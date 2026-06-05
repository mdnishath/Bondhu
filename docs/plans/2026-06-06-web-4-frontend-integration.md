# Web Plan 4 — Frontend Integration (Bondhu UI → API)

> **For agentic workers:** This wires the exported Bondhu static design (`web/public/`) to the live backend. The frontend is vanilla HTML/CSS/JS verified in the browser (not unit-TDD). Each task ends with a manual browser check + commit.

**Goal:** Turn the static Bondhu prototype into a working web chat client backed by the Bondhu server — login, account linking (pairing/QR), real chats/messages, send, translation display, TTS playback, settings, and live Socket.IO updates.

**Architecture:** The Express backend serves `web/public/` statically (same origin → no CORS). A shared `assets/api.js` wraps `fetch` with the JWT and exposes typed helpers + a Socket.IO connection. `assets/shell.js` becomes data-driven (fetches accounts + chats). Each page's inline mock script is replaced with API calls. App auth is email/password (our backend); phone/QR/pairing is for linking a WhatsApp account.

**Tech Stack:** Vanilla JS (keep the design's stack), Socket.IO client (CDN), the existing backend.

Working dir: `E:\New Whatsapp`. Builds on master (server done). Branch: `web-frontend`.

---

### Task 1: Backend serves the web client

**Files:** Modify `server/src/api/server.ts`, `server/src/index.ts`

- [ ] Serve `web/public` as static at `/` and keep `/api/*` for the API.
- In `server.ts`, after the routes, add static middleware pointed at the web dir (path resolved relative to repo root). Add an SPA-ish fallback that serves `login.html` for unknown non-API GETs is NOT needed (multi-page); just `express.static`.

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(__dirname, '../../../web/public');
app.use(express.static(webDir));
```
(Place AFTER `/api` routes so API wins.)

- [ ] **Browser check:** `npm run dev`, open `http://localhost:3050/login.html` → Bondhu login renders.
- [ ] Commit: `feat(web): serve web/public from backend`.

---

### Task 2: API client (`assets/api.js`)

**Files:** Create `web/public/assets/api.js`

- [ ] Implement a small client used by every page:

```javascript
const API = {
  base: '',
  token: () => localStorage.getItem('bondhu_jwt') || '',
  account: () => localStorage.getItem('bondhu_account') || '',
  setToken: (t) => localStorage.setItem('bondhu_jwt', t),
  setAccount: (a) => localStorage.setItem('bondhu_account', a),
  logout: () => { localStorage.removeItem('bondhu_jwt'); localStorage.removeItem('bondhu_account'); },

  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = API.token(); if (tok) headers.Authorization = 'Bearer ' + tok;
    const res = await fetch(API.base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) { API.logout(); location.href = 'login.html'; throw new Error('unauthorized'); }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.blob();
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  },
  get: (p) => API.req('GET', p),
  post: (p, b) => API.req('POST', p, b),
  del: (p) => API.req('DELETE', p),

  // auth
  register: (email, password, name) => API.post('/api/auth/register', { email, password, name }),
  login: (email, password) => API.post('/api/auth/login', { email, password }),
  me: () => API.get('/api/auth/me'),

  // accounts
  accounts: () => API.get('/api/accounts'),
  addAccount: (label) => API.post('/api/accounts', { label }),
  pair: (id, phone) => API.post('/api/accounts/' + encodeURIComponent(id) + '/pair', { phone }),
  status: (acc) => API.get('/api/status?account=' + encodeURIComponent(acc)),
  removeAccount: (id) => API.del('/api/accounts/' + encodeURIComponent(id)),

  // chats + messages
  chats: (acc) => API.get('/api/chats?account=' + encodeURIComponent(acc) + '&limit=100'),
  messages: (acc, jid) => API.get('/api/messages/' + encodeURIComponent(jid) + '?account=' + encodeURIComponent(acc) + '&limit=50'),
  send: (acc, chatId, message) => API.post('/api/send?account=' + encodeURIComponent(acc), { chatId, message }),
  markRead: (acc, jid) => API.post('/api/chats/' + encodeURIComponent(jid) + '/mark-read?account=' + encodeURIComponent(acc)),
  react: (acc, msgId, emoji) => API.post('/api/react?account=' + encodeURIComponent(acc), { msgId, emoji }),
  retranslate: (acc, msgId, text, chatId) => API.post('/api/retranslate?account=' + encodeURIComponent(acc), { msgId, text, chatId }),

  // settings
  keys: () => API.get('/api/settings/keys'),
  addKey: (keyValue, label) => API.post('/api/settings/keys', { keyValue, label }),
  removeKey: (id) => API.del('/api/settings/keys/' + id),
  language: () => API.get('/api/settings/language'),
  setLanguage: (lang) => API.post('/api/settings/language', { lang }),

  // realtime
  socket: null,
  connect() {
    if (API.socket || !API.token()) return API.socket;
    API.socket = io(API.base, { auth: { token: API.token() } });
    return API.socket;
  },
  requireAuth() { if (!API.token()) { location.href = 'login.html'; } },
};
window.API = API;
```

- [ ] Add Socket.IO client CDN `<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>` to each page before `api.js` (Tasks 4–8 add it per page).
- [ ] Commit: `feat(web): add api.js client`.

---

### Task 3: Auth — email/password login + register

**Files:** Modify `web/public/login.html`

- [ ] Replace the phone-number form with an email/password form that has **Log in / Create account** toggle. Keep the brand panel + Bondhu styling (reuse existing `.field`, `.input`, `.btn-primary` classes). On success: `API.setToken(res.token)` → go to `Bondhu - Chat Client.html`.
- [ ] Replace the inline `signIn()` script:

```javascript
let mode = 'login';
function toggleMode(){ mode = mode==='login'?'register':'login'; renderMode(); }
function renderMode(){ /* show/hide name field, swap button + heading text */ }
async function submitAuth(e){
  e.preventDefault();
  const email = byId('email').value.trim(), pass = byId('pass').value, name = byId('name')?.value;
  const btn = byId('go'); btn.disabled = true;
  try {
    const res = mode==='login' ? await API.login(email, pass) : await API.register(email, pass, name);
    API.setToken(res.token);
    location.href = 'Bondhu - Chat Client.html';
  } catch (err) { showTip(err.message); btn.disabled = false; }
  return false;
}
```

- [ ] Add `<script src="assets/api.js"></script>` before the inline script.
- [ ] **Browser check:** register a user → redirected to chat client.
- [ ] Commit: `feat(web): wire login/register to backend auth`.

---

### Task 4: shell.js — data-driven rail + chat list

**Files:** Modify `web/public/assets/shell.js`

- [ ] Replace hardcoded `ACCOUNTS`/`CHATS` with state loaded from the API. Add:
  - `async function loadAccounts()` → `API.accounts()`, store, render rail; pick active account (localStorage or first connected).
  - `async function loadChats()` → `API.chats(activeAccount)`, render rows with `onclick` that navigates to the chat view with the jid (store selected jid in localStorage; the chat page reads it).
- [ ] Keep `renderRail`/`renderChatList`/`tickSVG`/`showTip` but feed them real data. Avatar initials derived from chat name; gradient from a hash of jid.
- [ ] Account dots: green when `status==='connected'`. Active account ring. Clicking an account sets active + reloads chats. The `+` add-account button → `link-device.html`.
- [ ] **Browser check:** open chat client → real chat list appears (after login + a linked account).
- [ ] Commit: `feat(web): make shell rail + chat list data-driven`.

---

### Task 5: Main chat view — messages, send, translation, realtime

**Files:** Modify `web/public/Bondhu - Chat Client.html`

- [ ] Replace the hardcoded message bubbles with a render function:
  - On load: `API.requireAuth()`, `API.connect()`, load accounts + chats (via shell), read selected jid, `API.messages(acc, jid)` → render bubbles. Show original + `translated` (when present) in the muted sub-text, with a 🔊 button (calls `/api/tts` and plays). Show reactions, tick states.
  - Composer: send via `API.send(acc, jid, text)`; optimistic append; clear input.
  - Header: contact name from the selected chat; globe icon → `translation-settings.html`; ⋮ menu.
  - Socket: on `message` (matching account+chat) append + translate sub-text; on `message_ack` update ticks; on `chat_update` refresh the list; on `message_reaction` update badges.
- [ ] On chat open: `API.markRead(acc, jid)`.
- [ ] Empty state when no account linked → prompt to link (link-device.html).
- [ ] **Browser check:** open a chat → real messages with translations; send a message → appears + arrives in WhatsApp; incoming message appears live.
- [ ] Commit: `feat(web): wire main chat view (messages/send/translation/realtime)`.

---

### Task 6: Account linking — pairing code + QR

**Files:** Modify `web/public/link-device.html`

- [ ] QR tab: `API.addAccount()` → poll `API.status(acc)` for `qr`; render the QR string with a QR lib (CDN `qrcode` or `qrcodejs`); on `status==='connected'` → go to chat client.
- [ ] Pairing tab: phone input → `API.addAccount()` then `API.pair(acc, phone)` → poll `status` for `pairingCode`; display the 8-digit code; on connected → chat client.
- [ ] Store the new account id as active.
- [ ] **Browser check:** link an account via pairing code (enter on phone) → connects → chats load.
- [ ] Commit: `feat(web): wire account linking (pairing + QR)`.

---

### Task 7: Settings — API keys + language

**Files:** Modify `web/public/settings.html`, `web/public/translation-settings.html`

- [ ] Settings: render `API.keys()` (masked, active), add key (`API.addKey`), delete (`API.removeKey`); language picker → `API.setLanguage`; logout → `API.logout()` + redirect.
- [ ] Translation-settings: global language select wired to `API.language()`/`setLanguage()`; per-chat override (optional now).
- [ ] **Browser check:** add the Google key, set language to Bengali, see it persist.
- [ ] Commit: `feat(web): wire settings (api keys + language)`.

---

### Task 8: Polish + full flow verification

- [ ] Add `<script>` tags (socket.io CDN + api.js) to every page that needs them; ensure `API.requireAuth()` guards the authed pages.
- [ ] **Full browser flow:** register → link account (pairing) → see real chats → open chat → translations show → send a message → arrives → change language → logout.
- [ ] Commit: `chore(web): final wiring polish`.

---

## Self-Review

- **Spec coverage (web/DESIGN.md):** serve + auth (1,3), data-driven rail/list (4), chat view with translation + TTS + realtime (5), account linking QR+pairing (6), settings + language (7). Forward/per-chat-language dialogs are optional polish, deferrable.
- **Auth mapping:** app login = email/password (backend); phone/QR/pairing = WhatsApp account linking. Resolved in Tasks 3 + 6.
- **No CORS:** backend serves the web client same-origin.
- **Verification:** browser-based per task (frontend has no unit harness); the backend it depends on is already 48-test + live-verified.
