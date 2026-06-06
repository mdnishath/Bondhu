import type { Account, ApiKeyView, Chat, LangOption, Message, User } from './types';

const TOKEN_KEY = 'bondhu_jwt';

export const auth = {
  token: () => localStorage.getItem(TOKEN_KEY) || '',
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  isAuthed: () => !!localStorage.getItem(TOKEN_KEY),
};

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tok = auth.token();
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    auth.clear();
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new HttpError('Session expired', 401);
  }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new HttpError((data && data.error) || res.statusText, res.status);
  return data as T;
}

const get = <T>(p: string) => req<T>('GET', p);
const post = <T>(p: string, b?: unknown) => req<T>('POST', p, b);
const del = <T>(p: string) => req<T>('DELETE', p);
const enc = encodeURIComponent;

export const api = {
  // auth
  register: (email: string, password: string, name?: string) =>
    post<{ token: string; user: User }>('/api/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    post<{ token: string; user: User }>('/api/auth/login', { email, password }),
  me: () => get<User>('/api/auth/me'),

  // accounts
  accounts: () => get<{ accounts: Account[] }>('/api/accounts'),
  addAccount: (label?: string) => post<{ accountId: string }>('/api/accounts', { label }),
  pair: (id: string, phone: string) => post<{ success: boolean }>(`/api/accounts/${enc(id)}/pair`, { phone }),
  status: (acc: string) =>
    get<{ connected: boolean; state: string; phoneNumber: string | null; qr: string | null; pairingCode: string | null }>(
      `/api/status?account=${enc(acc)}`,
    ),
  removeAccount: (id: string) => del<{ success: boolean }>(`/api/accounts/${enc(id)}`),

  // chats + messages
  chats: (acc: string) => get<{ chats: Chat[] }>(`/api/chats?account=${enc(acc)}&limit=100`),
  messages: (acc: string, jid: string) =>
    get<{ lang: string; messages: Message[] }>(`/api/messages/${enc(jid)}?account=${enc(acc)}&limit=50`),
  send: (acc: string, chatId: string, message: string, translateTo?: string) =>
    post<{ success: boolean; msgId: string | null; sentText?: string; original?: string }>(
      `/api/send?account=${enc(acc)}`,
      { chatId, message, translateTo },
    ),
  markRead: (acc: string, jid: string) => post(`/api/chats/${enc(jid)}/mark-read?account=${enc(acc)}`),
  clearChat: (acc: string, jid: string) => post<{ success: boolean }>(`/api/chats/${enc(jid)}/clear?account=${enc(acc)}`),
  react: (acc: string, msgId: string, emoji: string) => post(`/api/react?account=${enc(acc)}`, { msgId, emoji }),
  reply: (acc: string, chatId: string, msgId: string, text: string) =>
    post<{ success: boolean; msgId: string | null }>(`/api/reply?account=${enc(acc)}`, { chatId, msgId, text }),
  deleteMessage: (acc: string, msgId: string) => post(`/api/delete-message?account=${enc(acc)}`, { msgId }),
  deleteLocal: (acc: string, msgId: string) => post(`/api/delete-local?account=${enc(acc)}`, { msgId }),
  editMessage: (acc: string, msgId: string, text: string) => post(`/api/edit-message?account=${enc(acc)}`, { msgId, text }),
  forward: (acc: string, msgIds: string[], targetChatIds: string[]) =>
    post<{ success: boolean; forwarded: number }>(`/api/forward?account=${enc(acc)}`, { msgIds, targetChatIds }),
  tts: (acc: string, msgId: string, text: string, lang: string) =>
    post<{ audioBase64: string; mime: string }>(`/api/tts?account=${enc(acc)}`, { msgId, text, lang }),
  sendVoiceTranslated: (acc: string, chatId: string, message: string, translateTo?: string) =>
    post<{ success: boolean; voiceMsgId: string | null; textMsgId: string | null; sentText: string; original?: string; audioBase64: string; mime: string }>(
      `/api/send-voice?account=${enc(acc)}`,
      { chatId, message, translateTo },
    ),
  sendImage: (acc: string, chatId: string, imageBase64: string, caption?: string) =>
    post<{ success: boolean; msgId: string | null }>(`/api/send-image?account=${enc(acc)}`, { chatId, imageBase64, caption }),
  mediaUrl: (acc: string, msgId: string) => `/api/media/${enc(msgId)}?account=${enc(acc)}&token=${auth.token()}`,
  profilePic: (acc: string, jid: string) => `/api/profile-pic?account=${enc(acc)}&id=${enc(jid)}&token=${auth.token()}`,
  profile: (acc: string, jid: string) =>
    get<{ jid: string; about: string | null; phoneJid: string | null; phone: string | null }>(
      `/api/profile?account=${enc(acc)}&id=${enc(jid)}`,
    ),
  transcribe: (acc: string, audioBase64: string, mimeType: string) =>
    post<{ transcript: string }>(`/api/transcribe?account=${enc(acc)}`, { audioBase64, mimeType }),
  retranscribe: (acc: string, msgId: string) =>
    post<{ transcript: string }>(`/api/retranscribe?account=${enc(acc)}`, { msgId }),
  retranslate: (acc: string, msgId: string, text: string, chatId: string, _lang: string) =>
    post<{ translated: string; lang: string }>(`/api/retranslate?account=${enc(acc)}`, { msgId, text, chatId }),

  // settings
  keys: () => get<{ keys: ApiKeyView[] }>('/api/settings/keys'),
  addKey: (keyValue: string, label?: string) => post<ApiKeyView>('/api/settings/keys', { keyValue, label }),
  removeKey: (id: string) => del(`/api/settings/keys/${id}`),
  activateKey: (id: string) => post(`/api/settings/keys/${id}/activate`),
  language: () => get<{ lang: string; supported: LangOption[] }>('/api/settings/language'),
  setLanguage: (lang: string) => post('/api/settings/language', { lang }),
  setChatLanguage: (acc: string, jid: string, lang: string | null) =>
    post(`/api/chats/${enc(jid)}/language?account=${enc(acc)}`, { lang }),
};
