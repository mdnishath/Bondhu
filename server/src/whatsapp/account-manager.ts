import { EventEmitter } from 'events';
import type { DB } from '../db/db.js';
import type { AccountsRepo } from '../db/repositories/accounts.repo.js';
import type { ChatsRepo } from '../db/repositories/chats.repo.js';
import type { MessagesRepo, UpsertMessage } from '../db/repositories/messages.repo.js';
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

  async stop(accountId: string): Promise<void> {
    const conn = this.conns.get(accountId);
    if (conn) {
      await conn.stop();
      this.conns.delete(accountId);
    }
  }
}
