import { test, expect, vi } from 'vitest';
import request from 'supertest';
import { createContext } from '../app-context.js';
import { createApp } from './server.js';

async function authed() {
  const ctx = createContext(':memory:');
  ctx.manager.start = vi.fn(async () => {}) as any;
  ctx.manager.sendText = vi.fn(async () => 'sent-1') as any;
  const app = createApp(ctx);
  const reg = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret1' });
  return { ctx, app, token: reg.body.token, userId: reg.body.user.id };
}

test('create account, list, status, send', async () => {
  const { ctx, app, token } = await authed();

  const created = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ label: 'P' });
  expect(created.status).toBe(200);
  const accId = created.body.accountId;
  expect(ctx.manager.start).toHaveBeenCalledWith(accId, undefined);

  const list = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
  expect(list.body.accounts).toHaveLength(1);

  ctx.chats.upsert(accId, { jid: 'c@s.whatsapp.net', name: 'C' });
  ctx.chats.touch(accId, 'c@s.whatsapp.net', { lastMessageAt: 5, preview: 'hi' });
  ctx.messages.upsert({ accountId: accId, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 'c@s.whatsapp.net', fromMe: false, type: 'text', body: 'hi', timestamp: 5, ack: 0 });

  const chats = await request(app).get(`/api/chats?account=${accId}`).set('Authorization', `Bearer ${token}`);
  expect(chats.body.chats[0].jid).toBe('c@s.whatsapp.net');

  const msgs = await request(app).get(`/api/messages/${encodeURIComponent('c@s.whatsapp.net')}?account=${accId}`).set('Authorization', `Bearer ${token}`);
  expect(msgs.body.messages).toHaveLength(1);

  const sent = await request(app).post(`/api/send?account=${accId}`).set('Authorization', `Bearer ${token}`).send({ chatId: 'c@s.whatsapp.net', message: 'yo' });
  expect(sent.body.success).toBe(true);
  expect(ctx.manager.sendText).toHaveBeenCalledWith(accId, 'c@s.whatsapp.net', 'yo');
});

test('rejects access to another user account', async () => {
  const { app } = await authed();
  const other = await request(app).post('/api/auth/register').send({ email: 'z@z.com', password: 'secret1' });
  const acc = await request(app).post('/api/accounts').set('Authorization', `Bearer ${other.body.token}`).send({});
  const first = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'secret1' });
  const res = await request(app).get(`/api/chats?account=${acc.body.accountId}`).set('Authorization', `Bearer ${first.body.token}`);
  expect(res.status).toBe(403);
});
