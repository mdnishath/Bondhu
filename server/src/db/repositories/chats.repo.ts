import type { DB } from '../db.js';

export interface Chat {
  jid: string;
  name: string | null;
  isGroup: boolean;
  lastMessageAt: number | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export class ChatsRepo {
  constructor(private db: DB) {}

  upsert(accountId: string, c: { jid: string; name?: string; isGroup?: boolean }): void {
    this.db
      .prepare(
        `INSERT INTO chats (account_id,jid,name,is_group) VALUES (?,?,?,?)
         ON CONFLICT(account_id,jid) DO UPDATE SET
           name=COALESCE(excluded.name, chats.name),
           is_group=excluded.is_group`,
      )
      .run(accountId, c.jid, c.name ?? null, c.isGroup ? 1 : 0);
  }

  touch(
    accountId: string,
    jid: string,
    o: { lastMessageAt: number; preview: string; incUnread?: boolean },
  ): void {
    this.upsert(accountId, { jid });
    // Only advance last_message_at/preview when this message is newer than what
    // we already have (history sync delivers messages out of order). Unread
    // always accumulates when requested.
    this.db
      .prepare(
        `UPDATE chats SET
           last_message_at = CASE WHEN ? >= COALESCE(last_message_at,0) THEN ? ELSE last_message_at END,
           last_message_preview = CASE WHEN ? >= COALESCE(last_message_at,0) THEN ? ELSE last_message_preview END,
           unread_count = unread_count + ?
         WHERE account_id=? AND jid=?`,
      )
      .run(
        o.lastMessageAt, o.lastMessageAt,
        o.lastMessageAt, o.preview,
        o.incUnread ? 1 : 0,
        accountId, jid,
      );
  }

  clearUnread(accountId: string, jid: string): void {
    this.db.prepare('UPDATE chats SET unread_count=0 WHERE account_id=? AND jid=?').run(accountId, jid);
  }

  /** Store a saved-contact name (from the WhatsApp address book) for a jid. This
   *  takes priority over the volatile pushName captured in chats.name. */
  setContact(accountId: string, jid: string, name: string): void {
    this.db
      .prepare('INSERT INTO contacts (account_id,jid,name) VALUES (?,?,?) ON CONFLICT(account_id,jid) DO UPDATE SET name=excluded.name')
      .run(accountId, jid, name);
  }

  /** Saved contact name for a jid (used to label group-message senders). */
  contactName(accountId: string, jid: string): string | null {
    const r = this.db.prepare('SELECT name FROM contacts WHERE account_id=? AND jid=?').get(accountId, jid) as any;
    return r?.name ?? null;
  }

  list(accountId: string, limit: number, offset: number): Chat[] {
    return (
      this.db
        .prepare(
          `SELECT chats.account_id, chats.jid,
                  COALESCE(ct.name, chats.name) AS name,
                  chats.is_group, chats.last_message_at, chats.last_message_preview, chats.unread_count
           FROM chats LEFT JOIN contacts ct
             ON ct.account_id = chats.account_id AND ct.jid = chats.jid
           WHERE chats.account_id=?
           ORDER BY COALESCE(chats.last_message_at,0) DESC LIMIT ? OFFSET ?`,
        )
        .all(accountId, limit, offset) as any[]
    ).map((r) => this.map(r));
  }

  private map(r: any): Chat {
    return {
      jid: r.jid,
      name: r.name,
      isGroup: !!r.is_group,
      lastMessageAt: r.last_message_at,
      lastMessagePreview: r.last_message_preview,
      unreadCount: r.unread_count,
    };
  }
}
