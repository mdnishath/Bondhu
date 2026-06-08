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
