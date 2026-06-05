import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { AccountsRepo } from './accounts.repo.js';

test('create, list by user, update status, rename, delete', () => {
  const repo = new AccountsRepo(createDb(':memory:'));
  const acc = repo.create({ userId: 'u1', label: 'Primary' });
  expect(acc.id).toMatch(/^account-/);
  expect(repo.listByUser('u1')).toHaveLength(1);
  repo.updateStatus(acc.id, 'connected');
  expect(repo.findById(acc.id)?.status).toBe('connected');
  repo.rename(acc.id, '8801700000000', '8801700000000');
  const renamed = repo.findById('8801700000000');
  expect(renamed?.phone).toBe('8801700000000');
  expect(repo.findById(acc.id)).toBeUndefined();
  repo.remove('8801700000000');
  expect(repo.listByUser('u1')).toHaveLength(0);
});

test('setPhone records phone without changing the id', () => {
  const repo = new AccountsRepo(createDb(':memory:'));
  const acc = repo.create({ userId: 'u1' });
  repo.setPhone(acc.id, '8801799999999');
  expect(repo.findById(acc.id)?.phone).toBe('8801799999999');
});

test('isOwnedByUser guards ownership', () => {
  const repo = new AccountsRepo(createDb(':memory:'));
  const acc = repo.create({ userId: 'u1' });
  expect(repo.isOwnedByUser(acc.id, 'u1')).toBe(true);
  expect(repo.isOwnedByUser(acc.id, 'u2')).toBe(false);
});
