import { test, expect, vi } from 'vitest';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';
import { TtsService } from './tts.service.js';

test('synthesizes and caches audio', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db); keys.add('u1', 'KEY');
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ audioContent: 'QUJD' }) }) as any);
  const svc = new TtsService(db, new KeyRing(keys), fetchMock as any);

  const a1 = await svc.synthesize('u1', 'a1', 'm1', 'হ্যালো', 'bn');
  expect(a1.audioBase64).toBe('QUJD');
  const a2 = await svc.synthesize('u1', 'a1', 'm1', 'হ্যালো', 'bn');
  expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  expect(a2.mime).toBe('audio/mpeg');
});
