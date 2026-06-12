import { test, expect, vi } from 'vitest';
import { spawnSync } from 'child_process';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';
import { TranscriptionService } from './transcription.service.js';
import { FFMPEG_BIN } from './transcode.js';

const hasFfmpeg = spawnSync(FFMPEG_BIN, ['-version']).status === 0;

function makeSvc(fetchMock: any): TranscriptionService {
  const keys = new ApiKeysRepo(createDb(':memory:')); keys.add('u1', 'KEY');
  return new TranscriptionService(new KeyRing(keys), fetchMock);
}

function geminiOk(text: string) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}

/** 16k mono PCM16 WAV: tone/silence segments per `pattern` (t=tone secs, s=silence secs). */
function buildWav(pattern: Array<['t' | 's', number]>): Buffer {
  const rate = 16000;
  const parts = pattern.map(([kind, secs]) => {
    const n = Math.round(secs * rate);
    const b = Buffer.alloc(n * 2);
    if (kind === 't') for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), i * 2);
    return b;
  });
  const pcm = Buffer.concat(parts);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

test('transcribes audio via Gemini (original language)', async () => {
  const fetchMock = vi.fn(async () => geminiOk('hello world') as any);
  const svc = makeSvc(fetchMock);
  const text = await svc.transcribe('u1', 'AAAA', 'audio/ogg; codecs=opus');
  expect(text).toBe('hello world');
});

test('transcribeWav: short audio is a single Gemini call', async () => {
  const fetchMock = vi.fn(async () => geminiOk('short clip') as any);
  const svc = makeSvc(fetchMock);
  const text = await svc.transcribeWav('u1', buildWav([['t', 5]]));
  expect(text).toBe('short clip');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.skipIf(!hasFfmpeg)('transcribeWav: long audio is chunked at silences and joined in order', async () => {
  let n = 0;
  const fetchMock = vi.fn(async () => geminiOk(`chunk${++n}`) as any);
  const svc = makeSvc(fetchMock);
  // ~100s: 48s tone, 4s silence, 48s tone -> expect a cut inside the silence
  const text = await svc.transcribeWav('u1', buildWav([['t', 48], ['s', 4], ['t', 48]]));
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(text).toBe(Array.from({ length: n }, (_, i) => `chunk${i + 1}`).join('\n'));
}, 30000);
