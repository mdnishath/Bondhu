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
  const res = await svc.register('a@b.com', 'secret12', 'A');
  expect(res.token).toBeTruthy();
  expect(res.user.email).toBe('a@b.com');
  await expect(svc.register('a@b.com', 'secret12', 'A')).rejects.toThrow();
}, 30000);

test('login verifies password and verifyToken round-trips', async () => {
  const svc = makeService();
  await svc.register('a@b.com', 'secret12', 'A');
  await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow();
  const res = await svc.login('a@b.com', 'secret12');
  const decoded = svc.verifyToken(res.token);
  expect(decoded.userId).toBe(res.user.id);
}, 30000);

test('register enforces >=8 char password and rejects common passwords', async () => {
  const svc = makeService();
  await expect(svc.register('a@b.com', 'short', 'A')).rejects.toThrow(/at least 8/);
  await expect(svc.register('a@b.com', 'password', 'A')).rejects.toThrow(/too common/);
  const res = await svc.register('a@b.com', 'g00d-pass-1', 'A');
  expect(res.token).toBeTruthy();
}, 30000);

test('email is normalized (lowercased + trimmed) for storage and login', async () => {
  const svc = makeService();
  await svc.register('  User@Example.COM ', 'g00d-pass-1', 'A');
  const res = await svc.login('user@example.com', 'g00d-pass-1');
  expect(res.user.email).toBe('user@example.com');
}, 30000);

test('verifyToken rejects a token after the user token_version is bumped', async () => {
  const db = createDb(':memory:');
  const users = new UsersRepo(db);
  const svc = new AuthService(users, new SettingsRepo(db));
  const { token, user } = await svc.register('a@b.com', 'g00d-pass-1', 'A');
  expect(svc.verifyToken(token).userId).toBe(user.id);
  users.bumpTokenVersion(user.id);
  expect(() => svc.verifyToken(token)).toThrow();
}, 30000);

test('login locks an email after repeated failures', async () => {
  const svc = makeService();
  await svc.register('a@b.com', 'g00d-pass-1', 'A');
  for (let i = 0; i < 8; i++) await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(/Invalid credentials/);
  await expect(svc.login('a@b.com', 'wrong')).rejects.toThrow(/Too many/);
}, 30000);
