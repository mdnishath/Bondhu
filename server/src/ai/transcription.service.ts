import type { KeyRing } from './key-ring.js';

const MODEL = 'gemini-2.5-flash';

export class TranscriptionService {
  constructor(private keys: KeyRing, private fetchFn: typeof fetch = fetch) {}

  /** Transcribe audio in its ORIGINAL spoken language via Gemini. Gemini handles
   *  Bengali/Banglish (and most languages) far better than Google STT here, and
   *  runs on the same Gemini key as translation. The caller translates the
   *  transcript to the recipient's language at send time. */
  async transcribe(userId: string, audioBase64: string, mime: string): Promise<string> {
    const baseMime = (mime || 'audio/ogg').split(';')[0].trim();
    return this.keys.run(userId, async (key) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
      const resp = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: 'You are a verbatim speech-to-text transcriber. Write down EXACTLY what the speaker says, word for word, in the SAME language and its native script that they actually spoke. If they speak Bengali, output Bengali (বাংলা) script. If Hindi, Devanagari. If Arabic, Arabic script. NEVER translate, NEVER romanize, NEVER convert to English — keep the original language. Output ONLY the raw transcript text: no quotes, no language labels, no notes, no translation.' },
            { inlineData: { mimeType: baseMime, data: audioBase64 } },
          ] }],
        }),
      });
      if (!resp.ok) { const e: any = new Error(`stt ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    });
  }
}
