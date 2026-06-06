import { test, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createDb } from '../db/db.js';
import { AccountsRepo } from '../db/repositories/accounts.repo.js';
import { ChatsRepo } from '../db/repositories/chats.repo.js';
import { MessagesRepo } from '../db/repositories/messages.repo.js';
import { ReactionsRepo } from '../db/repositories/reactions.repo.js';
import { AccountManager } from './account-manager.js';

function fakeConn(accountId: string) {
  const e = new EventEmitter() as any;
  e.accountId = accountId;
  e.status = 'disconnected';
  e.qr = null;
  e.start = vi.fn(async () => {});
  e.stop = vi.fn(async () => {});
  e.sendText = vi.fn(async () => 'sent-1');
  e.canonicalJid = vi.fn(async (j: string) => j);
  e.resolvePhoneJid = vi.fn(async (j: string) => j);
  return e;
}

function makeManager() {
  const db = createDb(':memory:');
  const accounts = new AccountsRepo(db);
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const reactions = new ReactionsRepo(db);
  const conns: any[] = [];
  const mgr = new AccountManager(db, accounts, chats, messages, reactions, (id) => {
    const c = fakeConn(id);
    conns.push(c);
    return c;
  });
  return { mgr, accounts, chats, messages, reactions, conns };
}

test('start persists incoming message + chat and re-emits', async () => {
  const { mgr, accounts, chats, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const conn = conns[0];

  const events: any[] = [];
  mgr.on('message', (_id, m) => events.push(m));

  conn.emit('chat', 'c@s.whatsapp.net', 'C', false);
  conn.emit('message', {
    accountId: acc.id, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 'c@s.whatsapp.net',
    fromMe: false, type: 'text', body: 'hi', timestamp: 1000, ack: 0,
  });

  expect(messages.listByChat(acc.id, 'c@s.whatsapp.net', 10)).toHaveLength(1);
  expect(chats.list(acc.id, 10, 0)[0].lastMessagePreview).toBe('hi');
  expect(events).toHaveLength(1);
});

test('incoming @lid message auto-heals an earlier split phone chat', async () => {
  const { mgr, accounts, messages, chats, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const conn = conns[0];
  const BARE = '8801744243205@s.whatsapp.net';
  const LID = '23081187860486@lid';
  // the live mapping resolves this @lid to the phone (with a device suffix).
  conn.resolvePhoneJid = vi.fn(async (j: string) => (j === LID ? '8801744243205:0@s.whatsapp.net' : j));

  // earlier: outgoing to a typed number landed on a bare phone chat.
  await mgr.sendText(acc.id, BARE, 'hello (sent before reply)');
  expect(messages.listByChat(acc.id, BARE, 10)).toHaveLength(1);

  // now: their reply arrives keyed by @lid.
  conn.emit('chat', LID, 'Client', false);
  conn.emit('message', {
    accountId: acc.id, msgId: 'r1', chatJid: LID, senderJid: LID,
    fromMe: false, type: 'text', body: 'hi back', timestamp: 2000, ack: 0,
  });
  await new Promise((r) => setImmediate(r)); // let the async handler settle

  // the two chats are now one @lid thread holding both messages.
  expect(messages.listByChat(acc.id, BARE, 10)).toHaveLength(0);
  expect(messages.listByChat(acc.id, LID, 10)).toHaveLength(2);
  const list = chats.list(acc.id, 10, 0);
  expect(list).toHaveLength(1);
  expect(list[0].jid).toBe(LID);
});

test('phone event records phone on the stable account id', async () => {
  const { mgr, accounts, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  conns[0].emit('phone', '8801711111111');
  // id stays stable; only the phone column is set
  expect(accounts.findById(acc.id)?.phone).toBe('8801711111111');
  expect(conns[0].accountId).toBe(acc.id);
});

test('sendText stores an outgoing message', async () => {
  const { mgr, accounts, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  void conns;
  const id = await mgr.sendText(acc.id, 'c@s.whatsapp.net', 'yo');
  expect(id).toBe('sent-1');
  expect(messages.listByChat(acc.id, 'c@s.whatsapp.net', 10)[0].body).toBe('yo');
});

test('reaction event is stored and re-emitted', async () => {
  const { mgr, accounts, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  const got: any[] = [];
  mgr.on('reaction', (id, msgId, emoji) => got.push({ id, msgId, emoji }));
  conns[0].emit('reaction', 'm1', '❤️', false, 's1');
  expect(mgr.reactionsFor(acc.id, ['m1'])['m1']?.[0].emoji).toBe('❤️');
  expect(got[0]).toMatchObject({ msgId: 'm1', emoji: '❤️' });
});

test('action methods delegate to the connection with stored message', async () => {
  const { mgr, accounts, messages, conns } = makeManager();
  const acc = accounts.create({ userId: 'u1' });
  await mgr.start(acc.id);
  conns[0].react = vi.fn(async () => {});
  conns[0].deleteMessage = vi.fn(async () => {});
  messages.upsert({ accountId: acc.id, msgId: 'm1', chatJid: 'c@s.whatsapp.net', senderJid: 's', fromMe: false, type: 'text', body: 'hi', timestamp: 1, ack: 0 });
  await mgr.react(acc.id, 'm1', '👍');
  await mgr.deleteForEveryone(acc.id, 'm1');
  expect(conns[0].react).toHaveBeenCalled();
  expect(conns[0].deleteMessage).toHaveBeenCalled();
  expect(messages.getById(acc.id, 'm1')?.type).toBe('deleted');
});
