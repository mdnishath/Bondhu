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

test('throws if no keys configured', async () => {
  const ring = new KeyRing(new ApiKeysRepo(createDb(':memory:')));
  await expect(ring.run('u1', async () => 'x')).rejects.toThrow(/no api key/i);
});
