import { test, expect } from 'vitest';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';

test('runs with active key and rotates on quota error', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db);
  keys.add('u1', 'KEY_A');
  keys.add('u1', 'KEY_B');
  const ring = new KeyRing(keys);
  const seen: string[] = [];
  const result = await ring.run('u1', async (key) => {
    seen.push(key);
    if (key === 'KEY_A') { const e: any = new Error('quota'); e.status = 429; throw e; }
    return 'ok';
  });
  expect(result).toBe('ok');
  expect(seen).toEqual(['KEY_A', 'KEY_B']);
});

test('rotates on 403 service-blocked to a key scoped for the service', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db);
  keys.add('u1', 'GEMINI_KEY'); // blocked for tts
  keys.add('u1', 'CLOUD_KEY');  // works for tts
  const ring = new KeyRing(keys);
  const seen: string[] = [];
  const result = await ring.run('u1', async (key) => {
    seen.push(key);
    if (key === 'GEMINI_KEY') { const e: any = new Error('blocked'); e.status = 403; throw e; }
    return 'audio';
  });
  expect(result).toBe('audio');
  expect(seen).toEqual(['GEMINI_KEY', 'CLOUD_KEY']);
});

test('does not rotate on 400 (bad request)', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db);
  keys.add('u1', 'K1'); keys.add('u1', 'K2');
  const ring = new KeyRing(keys);
  let calls = 0;
  await expect(ring.run('u1', async () => { calls++; const e: any = new Error('bad'); e.status = 400; throw e; }))
    .rejects.toThrow('bad');
  expect(calls).toBe(1); // stopped at first key
});

test('throws if no keys configured', async () => {
  const ring = new KeyRing(new ApiKeysRepo(createDb(':memory:')));
  await expect(ring.run('u1', async () => 'x')).rejects.toThrow(/no api key/i);
});
