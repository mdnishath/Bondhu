import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { UsersRepo } from './users.repo.js';

test('create and find user by email', () => {
  const repo = new UsersRepo(createDb(':memory:'));
  const u = repo.create({ email: 'a@b.com', passwordHash: 'h', name: 'A' });
  expect(u.id).toBeTruthy();
  const found = repo.findByEmail('a@b.com');
  expect(found?.name).toBe('A');
  expect(repo.findByEmail('none@x.com')).toBeUndefined();
});
