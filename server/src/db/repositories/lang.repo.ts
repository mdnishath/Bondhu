import type { DB } from '../db.js';

export class LangRepo {
  constructor(private db: DB, private defaultLang = 'bn') {}

  getGlobal(userId: string): string {
    const r = this.db.prepare('SELECT lang FROM user_lang WHERE user_id=?').get(userId) as any;
    return r?.lang ?? this.defaultLang;
  }

  setGlobal(userId: string, lang: string): void {
    this.db.prepare('INSERT INTO user_lang (user_id,lang) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET lang=excluded.lang')
      .run(userId, lang);
  }

  getChat(userId: string, accountId: string, chatJid: string): string | undefined {
    const r = this.db.prepare('SELECT lang FROM chat_lang WHERE user_id=? AND account_id=? AND chat_jid=?')
      .get(userId, accountId, chatJid) as any;
    return r?.lang;
  }

  setChat(userId: string, accountId: string, chatJid: string, lang: string): void {
    this.db.prepare(
      `INSERT INTO chat_lang (user_id,account_id,chat_jid,lang) VALUES (?,?,?,?)
       ON CONFLICT(user_id,account_id,chat_jid) DO UPDATE SET lang=excluded.lang`,
    ).run(userId, accountId, chatJid, lang);
  }

  clearChat(userId: string, accountId: string, chatJid: string): void {
    this.db.prepare('DELETE FROM chat_lang WHERE user_id=? AND account_id=? AND chat_jid=?')
      .run(userId, accountId, chatJid);
  }

  resolve(userId: string, accountId: string, chatJid: string): string {
    return this.getChat(userId, accountId, chatJid) ?? this.getGlobal(userId);
  }
}
