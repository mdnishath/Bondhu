import { test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { wavToOpus } from './transcode.js';

const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version']).status === 0;

// Minimal PCM16 mono WAV builder (test-local; mirrors tts.service's header).
function wav(pcm: Buffer, rate = 24000, ch = 1): Buffer {
  const bps = 16, byteRate = (rate * ch * bps) / 8, blockAlign = (ch * bps) / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bps, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

test.skipIf(!hasFfmpeg)('wavToOpus returns a non-empty OGG/Opus buffer', async () => {
  const pcm = Buffer.alloc((24000 * 2) / 5); // 200ms of silence
  const ogg = await wavToOpus(wav(pcm));
  expect(ogg.length).toBeGreaterThan(0);
  expect(ogg.slice(0, 4).toString('ascii')).toBe('OggS');
});
