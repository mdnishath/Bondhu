import { EventEmitter } from 'events';
import type { DB } from '../db/db.js';
import type { AccountsRepo } from '../db/repositories/accounts.repo.js';
import type { ChatsRepo } from '../db/repositories/chats.repo.js';
import type { MessagesRepo, UpsertMessage } from '../db/repositories/messages.repo.js';
import type { ReactionsRepo } from '../db/repositories/reactions.repo.js';
import { WaConnection } from './wa-connection.js';

export type ConnFactory = (accountId: string, db: DB) => any;

/** Owns all WaConnections, persists their events, and re-emits for the gateway.
 *  Re-emitted events: 'message'(accountId,msg), 'status'(accountId,status,info),
 *  'qr'(accountId,qr), 'pairing'(accountId,code), 'ack'(accountId,msgId,ack),
 *  'chat_update'(accountId,jid). */
export class AccountManager extends EventEmitter {
  private conns = new Map<string, any>();

  constructor(
    private db: DB,
    private accounts: AccountsRepo,
    private chats: ChatsRepo,
    private messages: MessagesRepo,
    private reactions: ReactionsRepo,
    private factory: ConnFactory = (id, db) => new WaConnection(id, db),
  ) {
    super();
  }

  get(accountId: string): any | undefined {
    return this.conns.get(accountId);
  }

  async start(accountId: string, pairPhone?: string): Promise<void> {
    if (this.conns.has(accountId)) return;
    const conn = this.factory(accountId, this.db);
    this.conns.set(accountId, conn);
    this.wire(conn);
    await conn.start(pairPhone);
  }

  private wire(conn: any): void {
    const id = conn.accountId;

    conn.on('qr', (qr: string) => this.emit('qr', id, qr));
    conn.on('pairing', (code: string) => this.emit('pairing', id, code));

    conn.on('status', (status: string, info?: any) => {
      this.accounts.updateStatus(id, status);
      this.emit('status', id, status, info);
    });

    conn.on('chat', (jid: string, name: string | undefined, isGroup: boolean) => {
      this.chats.upsert(id, { jid, name, isGroup });
      this.emit('chat_update', id, jid);
    });

    conn.on('contact', (jid: string, name: string) => {
      this.chats.setContact(id, jid, name);
      this.emit('chat_update', id, jid);
    });

    conn.on('message', (m: UpsertMessage, isHistory = false) => {
      this.messages.upsert(m);
      this.chats.touch(id, m.chatJid, {
        lastMessageAt: m.timestamp,
        preview: m.body ?? '',
        incUnread: !m.fromMe && !isHistory,
      });
      if (!isHistory) this.emit('message', id, m);
      this.emit('chat_update', id, m.chatJid);
    });

    conn.on('ack', (msgId: string, ack: number) => {
      this.messages.setAck(id, msgId, ack);
      this.emit('ack', id, msgId, ack);
    });

    conn.on('reaction', (msgId: string, emoji: string, fromMe: boolean, sender: string) => {
      this.reactions.set(id, msgId, sender, emoji, fromMe);
      this.emit('reaction', id, msgId, emoji, sender);
    });

    conn.on('phone', (phone: string) => {
      // Keep the stable account id; just record the revealed phone number.
      // (Renaming the id mid-connection raced the auth-state migration and
      //  left creds split across ids, stalling reconnects in 'authenticating'.)
      this.accounts.setPhone(conn.accountId, phone);
    });

    conn.on('logged_out', () => {
      this.accounts.updateStatus(conn.accountId, 'disconnected');
      this.emit('status', conn.accountId, 'disconnected');
    });
  }

  async sendText(accountId: string, jid: string, text: string): Promise<string | null> {
    const conn = this.conns.get(accountId);
    if (!conn) throw new Error('Account not connected');
    const msgId = await conn.sendText(jid, text);
    if (msgId) {
      const ts = Date.now();
      this.messages.upsert({
        accountId, msgId, chatJid: jid, senderJid: null, fromMe: true,
        type: 'text', body: text, timestamp: ts, ack: 1,
      });
      this.chats.touch(accountId, jid, { lastMessageAt: ts, preview: text });
      this.emit('chat_update', accountId, jid);
    }
    return msgId;
  }

  private requireConn(accountId: string): any {
    const conn = this.conns.get(accountId);
    if (!conn) throw new Error('Account not connected');
    return conn;
  }

  private getStored(accountId: string, msgId: string) {
    const m = this.messages.getById(accountId, msgId);
    if (!m) throw new Error('message not found');
    return m;
  }

  private storeOutgoing(accountId: string, jid: string, msgId: string, body: string, type = 'text'): void {
    const ts = Date.now();
    this.messages.upsert({ accountId, msgId, chatJid: jid, senderJid: null, fromMe: true, type, body, timestamp: ts, ack: 1 });
    this.chats.touch(accountId, jid, { lastMessageAt: ts, preview: body });
    this.emit('chat_update', accountId, jid);
  }

  reactionsFor(accountId: string, msgIds: string[]) {
    return this.reactions.listForChat(accountId, msgIds);
  }

  async react(accountId: string, msgId: string, emoji: string): Promise<void> {
    const conn = this.requireConn(accountId);
    const m = this.getStored(accountId, msgId);
    await conn.react(m, emoji);
    this.reactions.set(accountId, msgId, 'me', emoji, true);
  }

  async reply(accountId: string, jid: string, msgId: string, text: string): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const raw = this.messages.getRaw(accountId, msgId);
    if (!raw) throw new Error('original message unavailable');
    const sentId = await conn.reply(jid, text, raw);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, text);
    return sentId;
  }

  async forward(accountId: string, msgIds: string[], targetJids: string[]): Promise<number> {
    const conn = this.requireConn(accountId);
    let count = 0;
    for (const msgId of msgIds) {
      const raw = this.messages.getRaw(accountId, msgId);
      if (!raw) continue;
      for (const jid of targetJids) {
        try { await conn.forward(jid, raw); count++; } catch { /* skip */ }
      }
    }
    return count;
  }

  async deleteForEveryone(accountId: string, msgId: string): Promise<void> {
    const conn = this.requireConn(accountId);
    const m = this.getStored(accountId, msgId);
    await conn.deleteMessage(m);
    this.messages.markDeleted(accountId, msgId);
  }

  async markRead(accountId: string, jid: string): Promise<void> {
    this.chats.clearUnread(accountId, jid);
    const conn = this.conns.get(accountId);
    if (!conn) return;
    const latest = this.messages.listByChat(accountId, jid, 1).find((x) => !x.fromMe);
    if (latest) {
      try { await conn.markRead(this.getStored(accountId, latest.msgId)); } catch { /* best-effort */ }
    }
  }

  async sendImage(accountId: string, jid: string, buffer: Buffer, caption?: string): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const sentId = await conn.sendImage(jid, buffer, caption);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, caption ?? '[image]', 'image');
    return sentId;
  }

  async sendVoice(accountId: string, jid: string, buffer: Buffer): Promise<string | null> {
    const conn = this.requireConn(accountId);
    const sentId = await conn.sendVoice(jid, buffer);
    if (sentId) this.storeOutgoing(accountId, jid, sentId, '[voice]', 'ptt');
    return sentId;
  }

  async downloadMedia(accountId: string, msgId: string): Promise<{ buffer: Buffer; mime: string }> {
    const conn = this.requireConn(accountId);
    const raw = this.messages.getRaw(accountId, msgId);
    if (!raw) throw new Error('media unavailable');
    return conn.downloadMedia(raw);
  }

  async profilePic(accountId: string, jid: string): Promise<string | null> {
    const conn = this.conns.get(accountId);
    return conn ? conn.profilePicUrl(jid) : null;
  }

  async profileAbout(accountId: string, jid: string): Promise<string | null> {
    const conn = this.conns.get(accountId);
    return conn ? conn.fetchAbout(jid) : null;
  }

  /** Cached profile photo bytes. Avoids hitting WhatsApp on every avatar render
   *  (the chat list would otherwise fire one slow Baileys call per row). Caches
   *  hits for 24h and misses (no photo / privacy) for 6h as a negative cache. */
  async profilePicBytes(accountId: string, jid: string): Promise<{ mime: string; data: Buffer } | null> {
    const OK_TTL = 24 * 3600 * 1000;
    const NEG_TTL = 6 * 3600 * 1000;
    const now = Date.now();
    const row = this.db.prepare('SELECT mime, data, ok, fetched_at FROM profile_pics WHERE account_id=? AND jid=?')
      .get(accountId, jid) as any;
    if (row && now - row.fetched_at < (row.ok ? OK_TTL : NEG_TTL)) {
      return row.ok ? { mime: row.mime, data: row.data as Buffer } : null;
    }
    let result: { mime: string; data: Buffer } | null = null;
    try {
      const url = await this.profilePic(accountId, jid);
      if (url) {
        const up = await fetch(url);
        if (up.ok) result = { mime: up.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await up.arrayBuffer()) };
      }
    } catch { /* ignore — store as negative */ }
    this.db.prepare('INSERT OR REPLACE INTO profile_pics (account_id,jid,mime,data,ok,fetched_at) VALUES (?,?,?,?,?,?)')
      .run(accountId, jid, result?.mime ?? null, result?.data ?? null, result ? 1 : 0, now);
    return result;
  }

  async stop(accountId: string): Promise<void> {
    const conn = this.conns.get(accountId);
    if (conn) {
      await conn.stop();
      this.conns.delete(accountId);
    }
  }
}
