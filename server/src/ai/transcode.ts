import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';

// Resolve ffmpeg WITHOUT depending on the launch shell's PATH:
// explicit FFMPEG_PATH override -> bundled static binary (ffmpeg-static) -> PATH.
// The bundled binary means voice works regardless of which terminal starts the server.
export const FFMPEG_BIN: string = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

/** Pipe a buffer through ffmpeg (stdin → stdout) with the given output args. */
function ffmpegPipe(outputArgs: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', ...outputArgs]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let settled = false;
    const done = (e?: Error, val?: Buffer) => {
      if (settled) return;
      settled = true;
      if (e) reject(e); else resolve(val!);
    };
    ff.stdout.on('data', (d) => out.push(d as Buffer));
    ff.stderr.on('data', (d) => err.push(d as Buffer));
    ff.on('error', (e) => done(new Error(`ffmpeg spawn failed (is it on PATH? set FFMPEG_PATH): ${e.message}`)));
    ff.on('close', (code) => {
      if (code !== 0) return done(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(-300)}`));
      const buf = Buffer.concat(out);
      if (buf.length === 0) return done(new Error('ffmpeg produced empty output'));
      done(undefined, buf);
    });
    ff.stdin.on('error', () => { /* ignore EPIPE if ffmpeg exits early */ });
    ff.stdin.write(input);
    ff.stdin.end();
  });
}

/**
 * Transcode an ffmpeg-readable audio buffer (we feed WAV/PCM16 from Gemini TTS)
 * into OGG/Opus, the format WhatsApp voice notes (ptt) require. Single
 * responsibility: container/codec conversion — no knowledge of WhatsApp or TTS.
 */
export function wavToOpus(input: Buffer): Promise<Buffer> {
  return ffmpegPipe(['-c:a', 'libopus', '-b:a', '24k', '-f', 'ogg', 'pipe:1'], input);
}

/**
 * Transcode any ffmpeg-readable audio (browser webm, Android m4a/AAC, …) into
 * 16 kHz mono PCM16 WAV — the format speech recognizers handle best. Used for
 * transcription so Gemini gets clean, full-fidelity speech instead of the lossy
 * 24 kbps Opus we use for WhatsApp playback (low bitrate was degrading the STT
 * and inviting hallucinated transcripts).
 */
export function toWavForAsr(input: Buffer): Promise<Buffer> {
  return ffmpegPipe(['-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'], input);
}

// --- silence-aware chunking (single-shot Gemini silently DROPS whole stretches
// --- of speech on multi-minute audio; transcribing ≤60s chunks cut at natural
// --- pauses recovers every word) ---

export interface SilenceSpan { start: number; end: number; }

/** Locate the fmt/data chunks of a PCM16 WAV. Tolerates extra chunks (LIST…). */
function parseWavPcm16(buf: Buffer): { sampleRate: number; channels: number; dataOffset: number; dataLength: number } {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a WAV buffer');
  }
  let off = 12, sampleRate = 0, channels = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') { channels = buf.readUInt16LE(off + 10); sampleRate = buf.readUInt32LE(off + 12); }
    if (id === 'data') {
      if (!sampleRate) break;
      return { sampleRate, channels, dataOffset: off + 8, dataLength: Math.min(size, buf.length - off - 8) };
    }
    off += 8 + size + (size % 2); // chunks are word-aligned
  }
  throw new Error('WAV fmt/data chunk not found');
}

/** Duration (seconds) of a PCM16 WAV, from its header. */
export function wavPcm16DurationSecs(buf: Buffer): number {
  const { sampleRate, channels, dataLength } = parseWavPcm16(buf);
  return dataLength / (sampleRate * channels * 2);
}

/**
 * Detect silent stretches (≥1.2s under -35dB) via ffmpeg silencedetect.
 * Returns spans in seconds. ffmpeg writes the report to stderr; `-f null` has
 * no stdout, so this doesn't reuse ffmpegPipe.
 */
export function detectSilences(input: Buffer): Promise<SilenceSpan[]> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG_BIN, ['-hide_banner', '-i', 'pipe:0', '-af', 'silencedetect=noise=-35dB:d=1.2', '-f', 'null', '-']);
    const err: Buffer[] = [];
    ff.stderr.on('data', (d) => err.push(d as Buffer));
    ff.on('error', (e) => reject(new Error(`ffmpeg spawn failed: ${e.message}`)));
    ff.on('close', () => {
      const text = Buffer.concat(err).toString();
      const spans: SilenceSpan[] = [];
      const re = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) spans.push({ start: Number(m[1]), end: Number(m[2]) });
      resolve(spans);
    });
    ff.stdin.on('error', () => { /* ignore EPIPE */ });
    ff.stdin.write(input);
    ff.stdin.end();
  });
}

/**
 * Plan cut points so every chunk is ≤ maxChunkSecs, preferring the LAST silence
 * midpoint inside each window (cuts land in pauses, never mid-word). Falls back
 * to a hard cut when a window has no detected silence.
 */
export function planChunkCuts(silences: SilenceSpan[], totalSecs: number, maxChunkSecs = 60): number[] {
  const cuts: number[] = [];
  let prev = 0;
  while (totalSecs - prev > maxChunkSecs) {
    const window = silences
      .map((s) => (s.start + s.end) / 2)
      .filter((mid) => mid > prev + 5 && mid <= prev + maxChunkSecs);
    const cut = window.length ? window[window.length - 1] : prev + maxChunkSecs;
    cuts.push(cut);
    prev = cut;
  }
  return cuts;
}

/** Slice a PCM16 WAV at the given cut times (secs) into standalone WAV buffers. */
export function splitWavPcm16(buf: Buffer, cuts: number[]): Buffer[] {
  const { sampleRate, channels, dataOffset, dataLength } = parseWavPcm16(buf);
  const blockAlign = channels * 2;
  const toByte = (t: number) => Math.min(dataLength, Math.round(t * sampleRate) * blockAlign);
  const bounds = [0, ...cuts.map(toByte), dataLength];
  const parts: Buffer[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const pcm = buf.subarray(dataOffset + bounds[i], dataOffset + bounds[i + 1]);
    if (pcm.length === 0) continue;
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
    h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * blockAlign, 28); h.writeUInt16LE(blockAlign, 32);
    h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    parts.push(Buffer.concat([h, pcm]));
  }
  return parts;
}
