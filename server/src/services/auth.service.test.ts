import { test, expect } from 'vitest';
import { createDb } from '../db/db.js';
import { UsersRepo } from '../db/repositories/users.repo.js';
import { SettingsRepo } from '../db/repositories/settings.repo.js';
import { AuthService } from './auth.service.js';

function makeService() {
  const db = createDb(':memory:');
  return new AuthService(new UsersRepo(db), new SettingsRepo(db));
}

test('register returns token + user, rejects short password and duplicates', async () => {
  const svc = makeService();
  await expect(svc.register('a@b.com', '123', 'A')).rejects.toThrow();
  const res = await svc.register('a@b.com', 'secret1', 'A');
  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe('a@b.com');
  await expect(svc.register('a@b.com', 'secret1', 'A')).rejects.toThrow();
});

test('login verifies password and verifyToken round-trips', async () => {
  const svc = makeService();
  await svc.register('a@b.com', 'secret1', 'A');
  await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow();
  const res = await svc.login('a@b.com', 'secret1');
  const decoded = svc.verifyToken(res.token);
  expect(decoded.userId).toBe(res.user.id);
});
