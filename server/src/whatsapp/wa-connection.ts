import { EventEmitter } from 'events';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  BufferJSON,
} from '@whiskeysockets/baileys';
import type { WASocket, WAMessage, WAMessageKey } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import type { DB } from '../db/db.js';
import { useSqliteAuthState } from './auth-state.js';
import { normalizeMessage } from './normalize.js';

const logger = P({ level: 'silent' });

export type WaStatus = 'disconnected' | 'qr_pending' | 'authenticating' | 'connected';

/** Wraps a single Baileys socket for one account. Emits:
 *  'qr'(qr), 'pairing'(code), 'status'(status, info), 'message'(UpsertMessage),
 *  'ack'(msgId, ack), 'chat'(jid, name, isGroup), 'phone'(number),
 *  'ready'(), 'logged_out'() */
export class WaConnection extends EventEmitter {
  private sock?: WASocket;
  private _status: WaStatus = 'disconnected';
  private _qr: string | null = null;
  private _pairingCode: string | null = null;
  private _stopping = false;
  private pairPhone?: string;

  constructor(public accountId: string, private db: DB) {
    super();
  }

  get status(): WaStatus {
    return this._status;
  }
  get qr(): string | null {
    return this._qr;
  }
  get pairingCode(): string | null {
    return this._pairingCode;
  }

  /** Pass a phone number to request a pairing code instead of QR. */
  async start(pairPhone?: string): Promise<void> {
    this._stopping = false;
    this.pairPhone = pairPhone;
    const { state, saveCreds } = await useSqliteAuthState(this.db, this.accountId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({ version, auth: state, logger });
    this.sock = sock;

    // Address-book contact names: prefer saved name, then business, then pushName.
    const onContacts = (contacts: any[]) => {
      for (const c of contacts ?? []) {
        const jid = c?.id;
        if (!jid || String(jid).endsWith('@g.us')) continue;
        const name = c.name || c.verifiedName || c.notify;
        if (name) this.emit('contact', String(jid), String(name));
      }
    };

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        this._qr = qr;
        this._status = 'qr_pending';
        this.emit('qr', qr);
        this.emit('status', this._status);
        if (this.pairPhone && !sock.authState.creds.registered) {
          try {
            const code = await sock.requestPairingCode(this.pairPhone);
            this._pairingCode = code;
            process.stderr.write(`[Wa:${this.accountId}] pairing code: ${code}\n`);
            this.emit('pairing', code);
          } catch (e: any) {
            process.stderr.write(`[Wa:${this.accountId}] pairing code error: ${e?.message}\n`);
          }
        }
      }

      if (connection === 'connecting') {
        this._status = 'authenticating';
        this.emit('status', this._status);
      }

      if (connection === 'open') {
        this._qr = null;
        this._pairingCode = null;
        this._status = 'connected';
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0];
        if (phone) this.emit('phone', phone);
        this.emit('status', this._status, { phone });
        this.emit('ready');
      }

      if (connection === 'close') {
        this._status = 'disconnected';
        this.emit('status', this._status);
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        if (this._stopping) return;
        if (code === DisconnectReason.loggedOut) {
          this.emit('logged_out');
          return;
        }
        setTimeout(() => this.start(this.pairPhone).catch(() => {}), 3000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      for (const m of messages) {
        const norm = normalizeMessage(this.accountId, m);
        if (!norm) continue;
        norm.raw = JSON.stringify(m, BufferJSON.replacer);
        const name = m.pushName ?? undefined;
        const isGroup = norm.chatJid.endsWith('@g.us');
        this.emit('chat', norm.chatJid, name, isGroup);
        this.emit('message', norm);
      }
    });

    sock.ev.on('messages.reaction', (reactions) => {
      for (const r of reactions) {
        const msgId = r.key?.id;
        const emoji = r.reaction?.text ?? '';
        const fromMe = !!r.key?.fromMe;
        const sender = (r.reaction as any)?.key?.participant || (fromMe ? 'me' : (r.key?.remoteJid ?? 'unknown'));
        if (msgId) this.emit('reaction', msgId, emoji, fromMe, String(sender));
      }
    });

    // Initial / incremental history sync: WhatsApp delivers existing chats and
    // their past messages here (NOT via messages.upsert). Mark messages as
    // history so unread counts are not inflated by the back-fill.
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
      onContacts(contacts as any[]);
      for (const c of chats) {
        const jid = (c as any).id;
        if (!jid) continue;
        this.emit('chat', jid, (c as any).name ?? undefined, jid.endsWith('@g.us'));
      }
      for (const m of messages) {
        const norm = normalizeMessage(this.accountId, m);
        if (norm) {
          norm.raw = JSON.stringify(m, BufferJSON.replacer);
          this.emit('message', norm, true);
        }
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const upd of updates) {
        const ack = upd.update?.status;
        if (upd.key?.id && typeof ack === 'number') this.emit('ack', upd.key.id, ack);
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => onContacts(contacts as any[]));
    sock.ev.on('contacts.update', (updates) => onContacts(updates as any[]));
  }

  async sendText(jid: string, text: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { text });
    return sent?.key?.id ?? null;
  }

  private keyFor(stored: { msgId: string; chatJid: string; fromMe: boolean; senderJid: string | null }): WAMessageKey {
    const key: WAMessageKey = { id: stored.msgId, remoteJid: stored.chatJid, fromMe: stored.fromMe };
    if (stored.chatJid.endsWith('@g.us') && stored.senderJid) key.participant = stored.senderJid;
    return key;
  }

  private parseRaw(raw: string): WAMessage {
    return JSON.parse(raw, BufferJSON.reviver) as WAMessage;
  }

  async react(stored: any, emoji: string): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(stored.chatJid, { react: { text: emoji, key: this.keyFor(stored) } });
  }

  async reply(jid: string, text: string, rawQuoted: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const quoted = this.parseRaw(rawQuoted);
    const sent = await this.sock.sendMessage(jid, { text }, { quoted });
    return sent?.key?.id ?? null;
  }

  async forward(targetJid: string, rawMsg: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const msg = this.parseRaw(rawMsg);
    const sent = await this.sock.sendMessage(targetJid, { forward: msg });
    return sent?.key?.id ?? null;
  }

  async deleteMessage(stored: any): Promise<void> {
    if (!this.sock) throw new Error('Not connected');
    await this.sock.sendMessage(stored.chatJid, { delete: this.keyFor(stored) });
  }

  async markRead(stored: any): Promise<void> {
    if (!this.sock) return;
    await this.sock.readMessages([this.keyFor(stored)]);
  }

  async sendImage(jid: string, buffer: Buffer, caption?: string): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { image: buffer, caption: caption || undefined });
    return sent?.key?.id ?? null;
  }

  async sendVoice(jid: string, buffer: Buffer): Promise<string | null> {
    if (!this.sock) throw new Error('Not connected');
    const sent = await this.sock.sendMessage(jid, { audio: buffer, ptt: true, mimetype: 'audio/ogg; codecs=opus' });
    return sent?.key?.id ?? null;
  }

  async downloadMedia(rawMsg: string): Promise<{ buffer: Buffer; mime: string }> {
    const msg = this.parseRaw(rawMsg);
    const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
    const content: any = msg.message ?? {};
    const mime =
      content.imageMessage?.mimetype || content.audioMessage?.mimetype ||
      content.videoMessage?.mimetype || content.documentMessage?.mimetype || 'application/octet-stream';
    return { buffer, mime };
  }

  async profilePicUrl(jid: string): Promise<string | null> {
    if (!this.sock) return null;
    try {
      // profilePictureUrl can hang; cap it so it never blocks the request pipeline.
      const p = this.sock.profilePictureUrl(jid, 'image').catch(() => null);
      const url = await Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
      return url ?? null;
    } catch {
      return null;
    }
  }

  /** The contact's "about" / status text, or null (privacy / unavailable). */
  async fetchAbout(jid: string): Promise<string | null> {
    if (!this.sock) return null;
    try {
      const p = (this.sock.fetchStatus(jid) as Promise<any>).catch(() => null);
      const r = await Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), 6000))]);
      const s = Array.isArray(r) ? r[0]?.status : r;
      return s?.status ?? (typeof s === 'string' ? s : null);
    } catch {
      return null;
    }
  }

  async stop(): Promise<void> {
    this._stopping = true;
    try {
      this.sock?.end(undefined);
    } catch {}
    this._status = 'disconnected';
  }
}
