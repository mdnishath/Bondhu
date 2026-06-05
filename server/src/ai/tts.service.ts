import type { DB } from '../db/db.js';
import type { KeyRing } from './key-ring.js';
import { langOf } from './langs.js';

export interface TtsResult { audioBase64: string; mime: string; }

export class TtsService {
  constructor(private db: DB, private keys: KeyRing, private fetchFn: typeof fetch = fetch) {}

  private cacheGet(accountId: string, msgId: string, lang: string): TtsResult | undefined {
    const r = this.db.prepare('SELECT audio_base64, mime FROM tts_cache WHERE account_id=? AND msg_id=? AND lang=?')
      .get(accountId, msgId, lang) as any;
    return r ? { audioBase64: r.audio_base64, mime: r.mime } : undefined;
  }

  private cacheSet(accountId: string, msgId: string, lang: string, r: TtsResult): void {
    this.db.prepare('INSERT OR REPLACE INTO tts_cache (account_id,msg_id,lang,audio_base64,mime,created_at) VALUES (?,?,?,?,?,?)')
      .run(accountId, msgId, lang, r.audioBase64, r.mime, Date.now());
  }

  async synthesize(userId: string, accountId: string, msgId: string, text: string, lang: string): Promise<TtsResult> {
    const cached = this.cacheGet(accountId, msgId, lang);
    if (cached) return cached;
    const l = langOf(lang);
    const voice = l?.ttsVoice ?? 'en-US-Chirp3-HD-Achernar';
    const locale = l?.ttsLocale ?? 'en-US';

    const result = await this.keys.run(userId, async (key) => {
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`;
      const resp = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: locale, name: voice },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      });
      if (!resp.ok) { const e: any = new Error(`tts ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      if (!data.audioContent) throw new Error('empty audio');
      return { audioBase64: data.audioContent as string, mime: 'audio/mpeg' };
    });
    this.cacheSet(accountId, msgId, lang, result);
    return result;
  }
}
