import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ApiKeysRepo } from './api-keys.repo.js';

test('add (first becomes active), list masked, activate, remove', () => {
  const repo = new ApiKeysRepo(createDb(':memory:'));
  const k1 = repo.add('u1', 'AIzaAAAAAAAAAAAAAAAA1111', 'first');
  expect(k1.isActive).toBe(true);
  const k2 = repo.add('u1', 'AIzaBBBBBBBBBBBBBBBB2222', 'second');
  expect(k2.isActive).toBe(false);
  const list = repo.list('u1');
  expect(list[0].keyMasked).toMatch(/^AIza.+1111$/);
  expect(list[0].keyMasked).not.toContain('AAAA');
  expect(repo.activeKey('u1')).toBe('AIzaAAAAAAAAAAAAAAAA1111');
  repo.activate('u1', k2.id);
  expect(repo.activeKey('u1')).toBe('AIzaBBBBBBBBBBBBBBBB2222');
  repo.remove('u1', k2.id);
  expect(repo.activeKey('u1')).toBe('AIzaAAAAAAAAAAAAAAAA1111'); // falls back to remaining
});
