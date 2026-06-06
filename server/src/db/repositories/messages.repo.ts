import type { DB } from '../db.js';

export interface Message {
  msgId: string;
  chatJid: string;
  senderJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  timestamp: number;
  ack: number;
  transcript?: string | null;
}

export interface UpsertMessage {
  accountId: string;
  msgId: string;
  chatJid: string;
  senderJid: string | null;
  fromMe: boolean;
  type: string;
  body: string | null;
  timestamp: number;
  ack: number;
  raw?: string | null;
}

export class MessagesRepo {
  constructor(private db: DB) {}

  upsert(m: UpsertMessage): void {
    this.db
      .prepare(
        `INSERT INTO messages (account_id,msg_id,chat_jid,sender_jid,from_me,type,body,timestamp,ack,raw)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(account_id,msg_id) DO UPDATE SET
           body=excluded.body, type=excluded.type, ack=MAX(messages.ack, excluded.ack),
           raw=COALESCE(excluded.raw, messages.raw)`,
      )
      .run(m.accountId, m.msgId, m.chatJid, m.senderJid, m.fromMe ? 1 : 0, m.type, m.body, m.timestamp, m.ack, m.raw ?? null);
  }

  setAck(accountId: string, msgId: string, ack: number): void {
    this.db
      .prepare('UPDATE messages SET ack=MAX(ack,?) WHERE account_id=? AND msg_id=?')
      .run(ack, accountId, msgId);
  }

  getById(accountId: string, msgId: string): Message | undefined {
    const r = this.db.prepare('SELECT * FROM messages WHERE account_id=? AND msg_id=?').get(accountId, msgId) as any;
    return r ? this.map(r) : undefined;
  }

  getRaw(accountId: string, msgId: string): string | undefined {
    const r = this.db.prepare('SELECT raw FROM messages WHERE account_id=? AND msg_id=?').get(accountId, msgId) as any;
    return r?.raw ?? undefined;
  }

  markDeleted(accountId: string, msgId: string): void {
    this.db.prepare('UPDATE messages SET body=?, type=? WHERE account_id=? AND msg_id=?')
      .run('[deleted]', 'deleted', accountId, msgId);
  }

  setTranscript(accountId: string, msgId: string, transcript: string): void {
    this.db.prepare('UPDATE messages SET transcript=? WHERE account_id=? AND msg_id=?')
      .run(transcript, accountId, msgId);
  }

  setBody(accountId: string, msgId: string, body: string): void {
    this.db.prepare('UPDATE messages SET body=? WHERE account_id=? AND msg_id=?')
      .run(body, accountId, msgId);
  }

  clearChat(accountId: string, chatJid: string): void {
    this.db.prepare('DELETE FROM messages WHERE account_id=? AND chat_jid=?').run(accountId, chatJid);
  }

  listByChat(accountId: string, chatJid: string, limit: number, before?: number): Message[] {
    const beforeTs = before ?? Number.MAX_SAFE_INTEGER;
    return (
      this.db
        .prepare(
          `SELECT * FROM messages WHERE account_id=? AND chat_jid=? AND timestamp < ?
           ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(accountId, chatJid, beforeTs, limit) as any[]
    ).map((r) => this.map(r));
  }

  private map(r: any): Message {
    return {
      msgId: r.msg_id,
      chatJid: r.chat_jid,
      senderJid: r.sender_jid,
      fromMe: !!r.from_me,
      type: r.type,
      body: r.body,
      timestamp: r.timestamp,
      ack: r.ack,
      transcript: r.transcript ?? null,
    };
  }
}
