import type { KeyRing } from './key-ring.js';

export class TranscriptionService {
  constructor(private keys: KeyRing, private fetchFn: typeof fetch = fetch) {}

  async transcribe(userId: string, audioBase64: string, mime: string): Promise<string> {
    const encoding = /webm/i.test(mime) ? 'WEBM_OPUS' : 'OGG_OPUS';
    return this.keys.run(userId, async (key) => {
      const url = `https://speech.googleapis.com/v1/speech:recognize?key=${key}`;
      const resp = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding, sampleRateHertz: 48000, languageCode: 'en-US', enableAutomaticPunctuation: true,
            alternativeLanguageCodes: ['bn-BD', 'hi-IN', 'ar-XA', 'es-ES'],
          },
          audio: { content: audioBase64 },
        }),
      });
      if (!resp.ok) { const e: any = new Error(`stt ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      const text = (data.results ?? []).map((r: any) => r.alternatives?.[0]?.transcript ?? '').join(' ').trim();
      return text;
    });
  }
}
