import type { DB } from '../db.js';

export interface Reaction {
  msgId: string;
  senderJid: string;
  emoji: string;
  fromMe: boolean;
}

export class ReactionsRepo {
  constructor(private db: DB) {}

  /** Empty emoji removes the sender's reaction (WhatsApp allows one per sender). */
  set(accountId: string, msgId: string, senderJid: string, emoji: string, fromMe: boolean): void {
    if (!emoji || !emoji.trim()) {
      this.db.prepare('DELETE FROM reactions WHERE account_id=? AND msg_id=? AND sender_jid=?')
        .run(accountId, msgId, senderJid);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO reactions (account_id,msg_id,sender_jid,emoji,from_me) VALUES (?,?,?,?,?)
         ON CONFLICT(account_id,msg_id,sender_jid) DO UPDATE SET emoji=excluded.emoji, from_me=excluded.from_me`,
      )
      .run(accountId, msgId, senderJid, emoji, fromMe ? 1 : 0);
  }

  listForMessage(accountId: string, msgId: string): Reaction[] {
    return (this.db.prepare('SELECT * FROM reactions WHERE account_id=? AND msg_id=?').all(accountId, msgId) as any[])
      .map((r) => ({ msgId: r.msg_id, senderJid: r.sender_jid, emoji: r.emoji, fromMe: !!r.from_me }));
  }

  listForChat(accountId: string, msgIds: string[]): Record<string, Reaction[]> {
    const out: Record<string, Reaction[]> = {};
    for (const id of msgIds) {
      const list = this.listForMessage(accountId, id);
      if (list.length) out[id] = list;
    }
    return out;
  }
}
