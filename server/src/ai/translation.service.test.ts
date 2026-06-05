import { test, expect, vi } from 'vitest';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';
import { TranslationService } from './translation.service.js';

function geminiOk(text: string) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}

test('translates and caches by (msgId, lang)', async () => {
  const db = createDb(':memory:');
  const keys = new ApiKeysRepo(db); keys.add('u1', 'KEY');
  const fetchMock = vi.fn(async () => geminiOk('তুমি কেমন আছো?') as any);
  const svc = new TranslationService(db, new KeyRing(keys), fetchMock as any);

  const t1 = await svc.translate('u1', 'a1', 'msg1', 'How are you?', 'bn');
  expect(t1).toBe('তুমি কেমন আছো?');
  const t2 = await svc.translate('u1', 'a1', 'msg1', 'How are you?', 'bn');
  expect(t2).toBe('তুমি কেমন আছো?');
  expect(fetchMock).toHaveBeenCalledTimes(1); // cached
  expect(svc.cachedFor('a1', 'msg1', 'bn')).toBe('তুমি কেমন আছো?');
});
