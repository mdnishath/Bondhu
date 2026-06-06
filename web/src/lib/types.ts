export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Account {
  id: string;
  label: string | null;
  phone: string | null;
  status: 'connected' | 'qr_pending' | 'authenticating' | 'disconnected' | string;
  qr?: string | null;
}

export interface Chat {
  jid: string;
  name: string | null;
  isGroup: boolean;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface Reaction {
  msgId: string;
  senderJid: string;
  emoji: string;
  fromMe: boolean;
}

export interface Message {
  msgId: string;
  chatJid: string;
  senderJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  timestamp: number;
  ack: number;
  reactions?: Reaction[];
  translated?: string | null;
  original?: string; // for outgoing messages translated before sending
  translating?: string; // when set, bubble shows the animated loader with this label
  localAudio?: string;  // data URI for own TTS voice playback (no /api/media round-trip)
}

export interface ApiKeyView {
  id: string;
  label: string | null;
  keyMasked: string;
  isActive: boolean;
}

export interface LangOption {
  code: string;
  name: string;
  flag: string;
}
