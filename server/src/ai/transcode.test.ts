import { test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { wavToOpus, FFMPEG_BIN, wavPcm16DurationSecs, planChunkCuts, splitWavPcm16, detectSilences } from './transcode.js';

// Uses the same resolved binary the util uses (bundled ffmpeg-static by default),
// so this runs without depending on the shell PATH.
const hasFfmpeg = spawnSync(FFMPEG_BIN, ['-version']).status === 0;

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

// --- chunked-transcription helpers (long voice typing word-loss fix) ---

/** PCM16 sine tone at 16k mono — "speech" for silencedetect tests. */
function tonePcm(secs: number, rate = 16000): Buffer {
  const n = Math.round(secs * rate);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), i * 2);
  return b;
}

test('wavPcm16DurationSecs reads duration from header', () => {
  expect(wavPcm16DurationSecs(wav(Buffer.alloc(16000 * 2), 16000))).toBeCloseTo(1, 2);
  expect(wavPcm16DurationSecs(wav(Buffer.alloc(24000 * 2 * 3), 24000))).toBeCloseTo(3, 2);
});

test('planChunkCuts: short audio needs no cuts', () => {
  expect(planChunkCuts([], 45, 60)).toEqual([]);
  expect(planChunkCuts([{ start: 10, end: 12 }], 60, 60)).toEqual([]);
});

test('planChunkCuts: cuts at the last silence midpoint inside each window', () => {
  const silences = [
    { start: 20, end: 22 },   // mid 21
    { start: 50, end: 53 },   // mid 51.5  <- last one ≤ 60
    { start: 90, end: 92 },   // mid 91    <- last one ≤ 51.5+60
  ];
  const cuts = planChunkCuts(silences, 130, 60);
  expect(cuts).toEqual([51.5, 91]);
});

test('planChunkCuts: hard-cuts when no silence falls in a window', () => {
  expect(planChunkCuts([], 130, 60)).toEqual([60, 120]);
});

test('splitWavPcm16 slices at the cut times and preserves all PCM bytes', () => {
  const pcm = tonePcm(3); // 3s @16k
  const whole = wav(pcm, 16000);
  const parts = splitWavPcm16(whole, [1, 2.5]);
  expect(parts).toHaveLength(3);
  for (const p of parts) expect(p.slice(0, 4).toString('ascii')).toBe('RIFF');
  const datas = parts.map((p) => p.slice(44));
  expect(datas[0].length).toBe(16000 * 2);          // 1s
  expect(datas[1].length).toBe(24000 * 2);          // 1.5s
  expect(Buffer.concat(datas).equals(pcm)).toBe(true); // nothing lost
});

test.skipIf(!hasFfmpeg)('detectSilences finds the silent gap between two tones', async () => {
  const pcm = Buffer.concat([tonePcm(1.5), Buffer.alloc(16000 * 2 * 2), tonePcm(1.5)]); // 1.5s tone, 2s silence, 1.5s tone
  const silences = await detectSilences(wav(pcm, 16000));
  expect(silences.length).toBe(1);
  expect(silences[0].start).toBeGreaterThan(1.2);
  expect(silences[0].end).toBeLessThan(3.8);
  expect(silences[0].end - silences[0].start).toBeGreaterThan(1.5);
});
