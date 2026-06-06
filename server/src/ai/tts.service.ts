import type { DB } from '../db/db.js';
import type { KeyRing } from './key-ring.js';

export interface TtsResult { audioBase64: string; mime: string; }

// Voice is produced by Gemini TTS (same Gemini key as translation), NOT Google
// Cloud TTS. Gemini-TTS is served from the Gemini Developer API and returns raw
// 16-bit PCM, which we wrap in a WAV header for browser playback.
const TTS_MODEL = 'gemini-3.1-flash-tts-preview';
const TTS_VOICE = 'Achernar';
const TTS_STYLE = 'Read aloud in a warm, welcoming tone';

/** Wrap signed-16-bit little-endian mono PCM in a minimal WAV (RIFF) container. */
function pcm16ToWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // subchunk1 size (PCM)
  header.writeUInt16LE(1, 20);           // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

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

  /** Store synthesized audio under a real (sent) message id so the sender can
   *  replay their OWN voice note via /media even after a page reload (own
   *  outgoing media isn't downloadable from WhatsApp). */
  putForMsg(accountId: string, msgId: string, r: TtsResult): void {
    this.cacheSet(accountId, msgId, '_self', r);
  }

  /** Retrieve stored own-voice audio for a message id (lang-agnostic). */
  getForMsg(accountId: string, msgId: string): TtsResult | undefined {
    const r = this.db.prepare('SELECT audio_base64, mime FROM tts_cache WHERE account_id=? AND msg_id=? LIMIT 1')
      .get(accountId, msgId) as any;
    return r ? { audioBase64: r.audio_base64, mime: r.mime } : undefined;
  }

  async synthesize(userId: string, accountId: string, msgId: string, text: string, lang: string): Promise<TtsResult> {
    const cached = this.cacheGet(accountId, msgId, lang);
    if (cached) return cached;

    const result = await this.keys.run(userId, async (key) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${key}`;
      const resp = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // The "<style>: <text>" lead-in steers delivery; the model speaks only
          // the content after the colon. Gemini-TTS is multilingual, so one voice
          // serves every language and no per-locale voice mapping is needed.
          contents: [{ parts: [{ text: `${TTS_STYLE}: ${text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
          },
        }),
      });
      if (!resp.ok) { const e: any = new Error(`tts ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      const part = data?.candidates?.[0]?.content?.parts?.[0];
      const b64pcm: string | undefined = part?.inlineData?.data;
      if (!b64pcm) throw new Error('empty audio');
      const mimeType: string = part.inlineData.mimeType ?? '';
      const sampleRate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24000);
      const channels = Number(/channels=(\d+)/.exec(mimeType)?.[1] ?? 1);
      const wav = pcm16ToWav(Buffer.from(b64pcm, 'base64'), sampleRate, channels);
      return { audioBase64: wav.toString('base64'), mime: 'audio/wav' };
    });
    this.cacheSet(accountId, msgId, lang, result);
    return result;
  }
}
