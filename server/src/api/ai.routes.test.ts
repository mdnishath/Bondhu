import { test, expect, vi } from 'vitest';
import request from 'supertest';
import { createContext } from '../app-context.js';
import { createApp } from './server.js';

vi.mock('../ai/transcode.js', () => ({
  wavToOpus: vi.fn(async () => Buffer.from('OggS-fake-opus')),
}));

async function authed() {
  const ctx = createContext(':memory:');
  const app = createApp(ctx);
  const reg = await request(app).post('/api/auth/register').send({ email: 'a@b.com', password: 'secret1' });
  return { ctx, app, token: reg.body.token };
}

test('api key CRUD + language settings', async () => {
  const { app, token } = await authed();
  const H = { Authorization: `Bearer ${token}` };

  const add = await request(app).post('/api/settings/keys').set(H).send({ keyValue: 'AIzaXXXXXXXXXXXXXXXX9999', label: 'main' });
  expect(add.body.keyMasked).toMatch(/9999$/);
  const list = await request(app).get('/api/settings/keys').set(H);
  expect(list.body.keys).toHaveLength(1);
  expect(list.body.keys[0].isActive).toBe(true);

  const setLang = await request(app).post('/api/settings/language').set(H).send({ lang: 'en' });
  expect(setLang.body.success).toBe(true);
  const getLang = await request(app).get('/api/settings/language').set(H);
  expect(getLang.body.lang).toBe('en');
  expect(getLang.body.supported.length).toBeGreaterThan(5);
});

test('translate route uses injected service', async () => {
  const { ctx, app, token } = await authed();
  ctx.translation.translate = vi.fn(async () => 'অনুবাদ') as any;
  const created = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({});
  const acc = created.body.accountId;
  const res = await request(app).post(`/api/retranslate?account=${acc}`).set('Authorization', `Bearer ${token}`)
    .send({ msgId: 'm1', text: 'Hello', chatId: 'c1' });
  expect(res.body.translated).toBe('অনুবাদ');
});

test('send-voice translates, transcodes, sends voice then text', async () => {
  const { ctx, app, token } = await authed();
  const H = { Authorization: `Bearer ${token}` };
  ctx.translation.translateOutgoing = vi.fn(async () => 'Comment vas-tu ?') as any;
  ctx.tts.synthesize = vi.fn(async () => ({ audioBase64: 'QUJD', mime: 'audio/wav' })) as any;
  ctx.manager.sendVoice = vi.fn(async () => 'v1') as any;
  ctx.manager.sendText = vi.fn(async () => 't1') as any;
  const created = await request(app).post('/api/accounts').set(H).send({});
  const acc = created.body.accountId;

  const res = await request(app).post(`/api/send-voice?account=${acc}`).set(H)
    .send({ chatId: 'c1', message: 'tumi kemon acho', translateTo: 'fr' });

  expect(res.status).toBe(200);
  expect(ctx.translation.translateOutgoing).toHaveBeenCalled();
  expect(ctx.manager.sendVoice).toHaveBeenCalled();
  expect(ctx.manager.sendText).toHaveBeenCalledWith(acc, 'c1', 'Comment vas-tu ?');
  expect(res.body).toMatchObject({
    success: true, voiceMsgId: 'v1', textMsgId: 't1',
    sentText: 'Comment vas-tu ?', original: 'tumi kemon acho',
    audioBase64: 'QUJD', mime: 'audio/wav',
  });
});

test('send-voice reports partial (textMsgId null) when text send fails after voice', async () => {
  const { ctx, app, token } = await authed();
  const H = { Authorization: `Bearer ${token}` };
  ctx.translation.translateOutgoing = vi.fn(async () => 'Bonjour') as any;
  ctx.tts.synthesize = vi.fn(async () => ({ audioBase64: 'QUJD', mime: 'audio/wav' })) as any;
  ctx.manager.sendVoice = vi.fn(async () => 'v9') as any;
  ctx.manager.sendText = vi.fn(async () => { throw new Error('text send failed'); }) as any;
  const created = await request(app).post('/api/accounts').set(H).send({});
  const acc = created.body.accountId;
  const res = await request(app).post(`/api/send-voice?account=${acc}`).set(H)
    .send({ chatId: 'c1', message: 'salut', translateTo: 'fr' });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.voiceMsgId).toBe('v9');
  expect(res.body.textMsgId).toBe(null);
});
