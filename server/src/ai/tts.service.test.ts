import { test, expect, vi } from 'vitest';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';
import { TtsService } from './tts.service.js';

test('synthesizes Gemini TTS audio (wraps PCM in WAV) and caches', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db); keys.add('u1', 'KEY');
  const pcm = Buffer.from([1, 2, 3, 4, 5, 6]).toString('base64');
  const fetchMock = vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm } }] } }],
    }),
  }) as any);
  const svc = new TtsService(db, new KeyRing(keys), fetchMock as any);

  const a1 = await svc.synthesize('u1', 'a1', 'm1', 'হ্যালো', 'bn');
  expect(a1.mime).toBe('audio/wav');
  // playable WAV: RIFF header, then the original PCM bytes appended
  const buf = Buffer.from(a1.audioBase64, 'base64');
  expect(buf.slice(0, 4).toString('ascii')).toBe('RIFF');
  expect(buf.length).toBe(44 + 6);

  const a2 = await svc.synthesize('u1', 'a1', 'm1', 'হ্যালো', 'bn');
  expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  expect(a2.audioBase64).toBe(a1.audioBase64);
});

test('putForMsg / getForMsg store and retrieve own-voice audio by message id', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db); keys.add('u1', 'KEY');
  const svc = new TtsService(db, new KeyRing(keys), (async () => { throw new Error('no network'); }) as any);

  expect(svc.getForMsg('acc1', 'WAMSG1')).toBeUndefined();
  svc.putForMsg('acc1', 'WAMSG1', { audioBase64: 'QUJD', mime: 'audio/wav' });
  const got = svc.getForMsg('acc1', 'WAMSG1');
  expect(got).toEqual({ audioBase64: 'QUJD', mime: 'audio/wav' });
  // scoped per account
  expect(svc.getForMsg('other', 'WAMSG1')).toBeUndefined();
});
