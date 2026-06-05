import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { SettingsRepo } from './settings.repo.js';

test('get/set and getOrCreateJwtSecret is stable', () => {
  const repo = new SettingsRepo(createDb(':memory:'));
  expect(repo.get('missing')).toBeUndefined();
  repo.set('k', 'v');
  expect(repo.get('k')).toBe('v');
  const s1 = repo.getOrCreateJwtSecret();
  const s2 = repo.getOrCreateJwtSecret();
  expect(s1).toBe(s2);
  expect(s1.length).toBeGreaterThan(20);
});
