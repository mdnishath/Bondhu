import { test, expect, vi } from 'vitest';
import { createDb } from '../db/db.js';
import { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';
import { KeyRing } from './key-ring.js';
import { TranscriptionService } from './transcription.service.js';

test('transcribes audio via Gemini (original language)', async () => {
  const keys = new ApiKeysRepo(createDb(':memory:')); keys.add('u1', 'KEY');
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello world' }] } }] }) }) as any);
  const svc = new TranscriptionService(new KeyRing(keys), fetchMock as any);
  const text = await svc.transcribe('u1', 'AAAA', 'audio/ogg; codecs=opus');
  expect(text).toBe('hello world');
});
