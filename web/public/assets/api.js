/* ===== Bondhu API client (shared by all pages) ===== */
const API = {
  base: '',
  token: () => localStorage.getItem('bondhu_jwt') || '',
  account: () => localStorage.getItem('bondhu_account') || '',
  setToken: (t) => localStorage.setItem('bondhu_jwt', t),
  setAccount: (a) => localStorage.setItem('bondhu_account', a),
  selectedChat: () => localStorage.getItem('bondhu_chat') || '',
  setSelectedChat: (j) => localStorage.setItem('bondhu_chat', j),
  logout: () => {
    localStorage.removeItem('bondhu_jwt');
    localStorage.removeItem('bondhu_account');
    localStorage.removeItem('bondhu_chat');
    if (API.socket) { try { API.socket.disconnect(); } catch (e) {} API.socket = null; }
  },

  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = API.token();
    if (tok) headers.Authorization = 'Bearer ' + tok;
    const res = await fetch(API.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) { API.logout(); location.href = 'login.html'; throw new Error('Session expired'); }
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  },
  get: (p) => API.req('GET', p),
  post: (p, b) => API.req('POST', p, b),
  del: (p) => API.req('DELETE', p),

  // --- auth (app login) ---
  register: (email, password, name) => API.post('/api/auth/register', { email, password, name }),
  login: (email, password) => API.post('/api/auth/login', { email, password }),
  me: () => API.get('/api/auth/me'),

  // --- WhatsApp accounts ---
  accounts: () => API.get('/api/accounts'),
  addAccount: (label) => API.post('/api/accounts', { label }),
  pair: (id, phone) => API.post('/api/accounts/' + encodeURIComponent(id) + '/pair', { phone }),
  status: (acc) => API.get('/api/status?account=' + encodeURIComponent(acc)),
  removeAccount: (id) => API.del('/api/accounts/' + encodeURIComponent(id)),

  // --- chats + messages ---
  chats: (acc) => API.get('/api/chats?account=' + encodeURIComponent(acc) + '&limit=100'),
  messages: (acc, jid) =>
    API.get('/api/messages/' + encodeURIComponent(jid) + '?account=' + encodeURIComponent(acc) + '&limit=50'),
  send: (acc, chatId, message) => API.post('/api/send?account=' + encodeURIComponent(acc), { chatId, message }),
  markRead: (acc, jid) =>
    API.post('/api/chats/' + encodeURIComponent(jid) + '/mark-read?account=' + encodeURIComponent(acc)),
  react: (acc, msgId, emoji) => API.post('/api/react?account=' + encodeURIComponent(acc), { msgId, emoji }),
  retranslate: (acc, msgId, text, chatId) =>
    API.post('/api/retranslate?account=' + encodeURIComponent(acc), { msgId, text, chatId }),
  ttsUrl: () => null, // tts is POST; use API.tts()
  tts: (acc, msgId, text, lang) => API.post('/api/tts?account=' + encodeURIComponent(acc), { msgId, text, lang }),

  // --- settings ---
  keys: () => API.get('/api/settings/keys'),
  addKey: (keyValue, label) => API.post('/api/settings/keys', { keyValue, label }),
  removeKey: (id) => API.del('/api/settings/keys/' + id),
  language: () => API.get('/api/settings/language'),
  setLanguage: (lang) => API.post('/api/settings/language', { lang }),

  // --- realtime ---
  socket: null,
  connect() {
    if (API.socket || !API.token() || typeof io === 'undefined') return API.socket;
    API.socket = io(API.base, { auth: { token: API.token() } });
    return API.socket;
  },

  requireAuth() {
    if (!API.token()) { location.href = 'login.html'; return false; }
    return true;
  },
};
window.API = API;

/* small helpers shared across pages */
function byId(id) { return document.getElementById(id); }
function avatarGradient(seed) {
  const grads = [
    'linear-gradient(145deg,#00A884,#017a63)',
    'linear-gradient(145deg,#7c5cff,#4b2fb0)',
    'linear-gradient(145deg,#f0883e,#b85c1f)',
    'linear-gradient(145deg,#ec4d8e,#a02360)',
    'linear-gradient(145deg,#3aa0ff,#1a5fb4)',
    'linear-gradient(145deg,#2bb3a3,#0c6e62)',
    'linear-gradient(145deg,#39c46e,#15803d)',
    'linear-gradient(145deg,#6c7cff,#3b3fb0)',
  ];
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return grads[h % grads.length];
}
function initials(name) {
  const n = (name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!n) return '#';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function displayName(jid, name) {
  if (name) return name;
  const num = (jid || '').split('@')[0];
  return num.startsWith('account') ? num : '+' + num;
}
