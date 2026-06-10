import { test, expect } from 'vitest';
import request from 'supertest';
import { createContext } from '../app-context.js';
import { createApp } from './server.js';

function app() {
  return createApp(createContext(':memory:'));
}

test('register -> login -> me flow', async () => {
  const a = app();
  const reg = await request(a).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret12', name: 'A' });
  expect(reg.status).toBe(200);
  const token = reg.body.token;

  const me = await request(a).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(me.status).toBe(200);
  expect(me.body.email).toBe('a@b.com');

  const noauth = await request(a).get('/api/auth/me');
  expect(noauth.status).toBe(401);

  const login = await request(a).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret12' });
  expect(login.status).toBe(200);
  expect(login.body.user.id).toBe(reg.body.user.id);
});

test('logout revokes the token (subsequent /me is 401)', async () => {
  const a = app();
  const reg = await request(a).post('/api/auth/register').send({ email: 'lo@b.com', password: 'secret12', name: 'L' });
  expect(reg.status).toBe(200);
  const token = reg.body.token;

  const before = await request(a).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(before.status).toBe(200);

  const out = await request(a).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
  expect(out.status).toBe(200);
  expect(out.body).toEqual({ ok: true });

  const after = await request(a).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  expect(after.status).toBe(401);
});
