import type { DB } from '../db/db.js';
import type { KeyRing } from './key-ring.js';
import { langName } from './langs.js';

const MODEL = 'gemini-2.5-flash';

export class TranslationService {
  constructor(private db: DB, private keys: KeyRing, private fetchFn: typeof fetch = fetch) {}

  private cacheGet(accountId: string, msgId: string, lang: string): string | undefined {
    const r = this.db.prepare('SELECT text FROM translations WHERE account_id=? AND msg_id=? AND lang=?')
      .get(accountId, msgId, lang) as any;
    return r?.text;
  }

  cachedFor(accountId: string, msgId: string, lang: string): string | undefined {
    return this.cacheGet(accountId, msgId, lang);
  }

  private cacheSet(accountId: string, msgId: string, lang: string, text: string): void {
    this.db.prepare('INSERT OR REPLACE INTO translations (account_id,msg_id,lang,text,created_at) VALUES (?,?,?,?,?)')
      .run(accountId, msgId, lang, text, Date.now());
  }

  /** Low-level Gemini translate of arbitrary text into the named target language. */
  private async callGemini(userId: string, body: string, targetName: string): Promise<string> {
    const prompt = `Translate the following message into ${targetName}. Output ONLY the translation, no quotes or notes.\n\n${body}`;
    return this.keys.run(userId, async (key) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
      const resp = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!resp.ok) { const e: any = new Error(`gemini ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!out) throw new Error('empty translation');
      return out as string;
    });
  }

  /** Incoming message translation, cached per (accountId, msgId, lang). */
  async translate(userId: string, accountId: string, msgId: string, body: string, lang: string): Promise<string> {
    const cached = this.cacheGet(accountId, msgId, lang);
    if (cached) return cached;
    const text = await this.callGemini(userId, body, langName(lang));
    this.cacheSet(accountId, msgId, lang, text);
    return text;
  }

  /** Outgoing translation: translate the user's own text into the recipient's
   *  language right before sending. Not message-cached (no msgId yet). */
  async translateOutgoing(userId: string, text: string, lang: string): Promise<string> {
    return this.callGemini(userId, text, langName(lang));
  }
}
