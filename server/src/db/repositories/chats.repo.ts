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

  /** Fold the chat `fromJid` into `toJid` (unify a legacy phone-keyed chat into
   *  its `@lid` chat so a contact's incoming + outgoing live in ONE thread).
   *  Moves messages + per-chat language + saved contact name, recomputes the
   *  target's last-message/unread, then drops the empty source row. The target
   *  keeps its own language/name when it already has one. No-op when from===to.
   *  Returns the number of messages moved. Runs in a single transaction.
   *  (translations / reactions / tts_cache key on msg_id, so they follow the
   *   messages automatically.) */
  mergeChat(accountId: string, fromJid: string, toJid: string): number {
    if (!fromJid || !toJid || fromJid === toJid) return 0;
    // Cheap no-op path: nothing to merge if the source side has no chat row and
    // no messages. Keeps per-message auto-heal calls to two indexed lookups.
    const sourceExists =
      this.db.prepare('SELECT 1 FROM chats WHERE account_id=? AND jid=?').get(accountId, fromJid) ||
      this.db.prepare('SELECT 1 FROM messages WHERE account_id=? AND chat_jid=? LIMIT 1').get(accountId, fromJid);
    if (!sourceExists) return 0;
    const tx = this.db.transaction((): number => {
      const moved = this.db
        .prepare('UPDATE messages SET chat_jid=? WHERE account_id=? AND chat_jid=?')
        .run(toJid, accountId, fromJid).changes as number;

      // Per-chat language: move it onto the target only if the target has none;
      // either way the source row is removed afterwards.
      this.db
        .prepare('UPDATE OR IGNORE chat_lang SET chat_jid=? WHERE account_id=? AND chat_jid=?')
        .run(toJid, accountId, fromJid);
      this.db.prepare('DELETE FROM chat_lang WHERE account_id=? AND chat_jid=?').run(accountId, fromJid);

      // Saved contact name: copy to the target only if it doesn't have one.
      const fromContact = this.db
        .prepare('SELECT name FROM contacts WHERE account_id=? AND jid=?')
        .get(accountId, fromJid) as any;
      if (fromContact?.name) {
        this.db
          .prepare('INSERT INTO contacts (account_id,jid,name) VALUES (?,?,?) ON CONFLICT(account_id,jid) DO NOTHING')
          .run(accountId, toJid, fromContact.name);
      }

      // Recompute the target chat from the merged messages; sum unread; keep the
      // target's pushName, falling back to the source's.
      this.upsert(accountId, { jid: toJid });
      const last = this.db
        .prepare('SELECT timestamp, body FROM messages WHERE account_id=? AND chat_jid=? ORDER BY timestamp DESC LIMIT 1')
        .get(accountId, toJid) as any;
      const fromChat = this.db.prepare('SELECT name, unread_count FROM chats WHERE account_id=? AND jid=?').get(accountId, fromJid) as any;
      const toChat = this.db.prepare('SELECT unread_count FROM chats WHERE account_id=? AND jid=?').get(accountId, toJid) as any;
      this.db
        .prepare(
          `UPDATE chats SET
             last_message_at=?, last_message_preview=?,
             unread_count=?, name=COALESCE(name, ?)
           WHERE account_id=? AND jid=?`,
        )
        .run(
          last?.timestamp ?? null, last?.body ?? null,
          (fromChat?.unread_count ?? 0) + (toChat?.unread_count ?? 0),
          fromChat?.name ?? null,
          accountId, toJid,
        );

      this.db.prepare('DELETE FROM chats WHERE account_id=? AND jid=?').run(accountId, fromJid);
      return moved;
    });
    return tx();
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

  /** Chats with no saved contact name yet — used to backfill names onto `@lid`
   *  chats whose saved name is only known under the contact's phone jid. */
  chatsMissingContactName(accountId: string): string[] {
    return (
      this.db
        .prepare(
          `SELECT chats.jid FROM chats LEFT JOIN contacts ct
             ON ct.account_id = chats.account_id AND ct.jid = chats.jid
           WHERE chats.account_id = ? AND (ct.name IS NULL OR ct.name = '')`,
        )
        .all(accountId) as any[]
    ).map((r) => r.jid as string);
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
