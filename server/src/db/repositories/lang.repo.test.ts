import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { LangRepo } from './lang.repo.js';

test('global + per-chat language resolve with fallback', () => {
  const repo = new LangRepo(createDb(':memory:'));
  expect(repo.resolve('u1', 'a1', 'c1')).toBe('bn'); // default
  repo.setGlobal('u1', 'en');
  expect(repo.resolve('u1', 'a1', 'c1')).toBe('en');
  repo.setChat('u1', 'a1', 'c1', 'hi');
  expect(repo.resolve('u1', 'a1', 'c1')).toBe('hi');
  repo.clearChat('u1', 'a1', 'c1');
  expect(repo.resolve('u1', 'a1', 'c1')).toBe('en');
});
