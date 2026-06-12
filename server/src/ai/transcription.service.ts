import type { KeyRing } from './key-ring.js';
import { detectSilences, planChunkCuts, splitWavPcm16, wavPcm16DurationSecs } from './transcode.js';

const MODEL = 'gemini-2.5-flash';

// Above this duration a single Gemini call starts silently DROPPING whole
// stretches of speech (verified: a 213s clip lost one full 32s block), so we
// transcribe silence-aligned chunks instead and join them.
const SINGLE_SHOT_MAX_SECS = 75;
const CHUNK_SECS = 60;

const PROMPT =
  'You are a verbatim speech-to-text transcriber. Write down EXACTLY what the speaker says, word for word, in the SAME language and its native script that they actually spoke. If they speak Bengali, output Bengali (বাংলা) script. If Hindi, Devanagari. If Arabic, Arabic script. NEVER translate, NEVER romanize, NEVER convert to English — keep the original language. Transcribe the COMPLETE recording from the very beginning to the very end: the speaker may pause mid-recording, so keep transcribing after every pause, and if a phrase is repeated write it down every time it is spoken — never skip, condense, or collapse anything. Do NOT invent, summarize, paraphrase, or add greetings/words that were not actually spoken. If the audio is unclear, silent, or has no speech, output an empty string rather than guessing. Output ONLY the raw transcript text: no quotes, no language labels, no notes, no translation.';

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
            { text: PROMPT },
            { inlineData: { mimeType: baseMime, data: audioBase64 } },
          ] }],
          // Deterministic, faithful transcription — temperature 0 stops the model
          // from "creatively" hallucinating phrases (e.g. an English greeting) on
          // longer/quieter clips instead of transcribing what was actually said.
          generationConfig: { temperature: 0 },
        }),
      });
      if (!resp.ok) { const e: any = new Error(`stt ${resp.status}`); e.status = resp.status; throw e; }
      const data: any = await resp.json();
      return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    });
  }

  /** Transcribe a 16k mono PCM16 WAV (toWavForAsr output). Long recordings are
   *  split at natural pauses into ≤60s chunks and transcribed sequentially —
   *  one giant clip in a single call makes Gemini silently drop content. */
  async transcribeWav(userId: string, wav: Buffer): Promise<string> {
    if (wavPcm16DurationSecs(wav) <= SINGLE_SHOT_MAX_SECS) {
      return this.transcribe(userId, wav.toString('base64'), 'audio/wav');
    }
    const silences = await detectSilences(wav);
    const cuts = planChunkCuts(silences, wavPcm16DurationSecs(wav), CHUNK_SECS);
    const chunks = splitWavPcm16(wav, cuts);
    const out: string[] = [];
    for (const chunk of chunks) {
      const t = await this.transcribe(userId, chunk.toString('base64'), 'audio/wav');
      if (t) out.push(t);
    }
    return out.join('\n');
  }
}
