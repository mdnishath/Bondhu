import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ChatsRepo } from './chats.repo.js';
import { MessagesRepo } from './messages.repo.js';

test('upsert merges and list orders by recency', () => {
  const repo = new ChatsRepo(createDb(':memory:'));
  repo.upsert('a1', { jid: 'x@s.whatsapp.net', name: 'X', isGroup: false });
  repo.upsert('a1', { jid: 'y@s.whatsapp.net', name: 'Y', isGroup: false });
  repo.touch('a1', 'x@s.whatsapp.net', { lastMessageAt: 100, preview: 'hi', incUnread: true });
  repo.touch('a1', 'y@s.whatsapp.net', { lastMessageAt: 200, preview: 'yo' });
  const list = repo.list('a1', 10, 0);
  expect(list[0].jid).toBe('y@s.whatsapp.net');
  expect(list[1].unreadCount).toBe(1);
});

test('touch keeps the newest preview when messages arrive out of order', () => {
  const repo = new ChatsRepo(createDb(':memory:'));
  repo.touch('a1', 'x@s.whatsapp.net', { lastMessageAt: 300, preview: 'newest' });
  repo.touch('a1', 'x@s.whatsapp.net', { lastMessageAt: 100, preview: 'older' }); // out of order
  const c = repo.list('a1', 10, 0)[0];
  expect(c.lastMessageAt).toBe(300);
  expect(c.lastMessagePreview).toBe('newest');
});

test('mergeChat folds a phone chat into its @lid chat', () => {
  const db = createDb(':memory:');
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const PHONE = '880171@s.whatsapp.net';
  const LID = '23081187860486@lid';

  // Legacy split: older outgoing under the phone jid, newer incoming under @lid.
  messages.upsert({ accountId: 'a1', msgId: 'p1', chatJid: PHONE, senderJid: null, fromMe: true, type: 'text', body: 'old out', timestamp: 100, ack: 1 });
  messages.upsert({ accountId: 'a1', msgId: 'l1', chatJid: LID, senderJid: LID, fromMe: false, type: 'text', body: 'new in', timestamp: 200, ack: 0 });
  chats.touch('a1', PHONE, { lastMessageAt: 100, preview: 'old out' });
  chats.touch('a1', LID, { lastMessageAt: 200, preview: 'new in', incUnread: true });
  // contact name only known on the phone jid; per-chat language only on phone jid.
  chats.setContact('a1', PHONE, 'HL Digital');
  db.prepare('INSERT INTO chat_lang (user_id,account_id,chat_jid,lang) VALUES (?,?,?,?)').run('u1', 'a1', PHONE, 'en');

  const moved = chats.mergeChat('a1', PHONE, LID);
  expect(moved).toBe(1);

  // All messages now live under the @lid chat, in order.
  const msgs = messages.listByChat('a1', LID, 10);
  expect(msgs).toHaveLength(2);
  expect(messages.listByChat('a1', PHONE, 10)).toHaveLength(0);

  // The phone chat row is gone; only the @lid chat remains.
  const list = chats.list('a1', 10, 0);
  expect(list).toHaveLength(1);
  const merged = list[0];
  expect(merged.jid).toBe(LID);
  expect(merged.lastMessageAt).toBe(200);
  expect(merged.lastMessagePreview).toBe('new in');
  expect(merged.unreadCount).toBe(1);
  // contact name + chat language carried over to the @lid jid.
  expect(merged.name).toBe('HL Digital');
  expect(db.prepare('SELECT lang FROM chat_lang WHERE account_id=? AND chat_jid=?').get('a1', LID)).toMatchObject({ lang: 'en' });
  expect(db.prepare('SELECT lang FROM chat_lang WHERE account_id=? AND chat_jid=?').get('a1', PHONE)).toBeUndefined();
});

test('mergeChat keeps the target chat language/name when both sides have one', () => {
  const db = createDb(':memory:');
  const chats = new ChatsRepo(db);
  const messages = new MessagesRepo(db);
  const PHONE = '880171@s.whatsapp.net';
  const LID = '23081187860486@lid';
  messages.upsert({ accountId: 'a1', msgId: 'p1', chatJid: PHONE, senderJid: null, fromMe: true, type: 'text', body: 'p', timestamp: 100, ack: 1 });
  messages.upsert({ accountId: 'a1', msgId: 'l1', chatJid: LID, senderJid: LID, fromMe: false, type: 'text', body: 'l', timestamp: 200, ack: 0 });
  chats.touch('a1', PHONE, { lastMessageAt: 100, preview: 'p' });
  chats.touch('a1', LID, { lastMessageAt: 200, preview: 'l' });
  chats.setContact('a1', PHONE, 'OldName');
  chats.setContact('a1', LID, 'KeepName');
  db.prepare('INSERT INTO chat_lang (user_id,account_id,chat_jid,lang) VALUES (?,?,?,?)').run('u1', 'a1', PHONE, 'fr');
  db.prepare('INSERT INTO chat_lang (user_id,account_id,chat_jid,lang) VALUES (?,?,?,?)').run('u1', 'a1', LID, 'en');

  chats.mergeChat('a1', PHONE, LID);
  expect(chats.list('a1', 10, 0)[0].name).toBe('KeepName');
  expect(db.prepare('SELECT lang FROM chat_lang WHERE account_id=? AND chat_jid=?').get('a1', LID)).toMatchObject({ lang: 'en' });
  expect(db.prepare('SELECT COUNT(*) c FROM chat_lang WHERE account_id=? AND chat_jid=?').get('a1', PHONE)).toMatchObject({ c: 0 });
});

test('mergeChat is a no-op when source equals target', () => {
  const db = createDb(':memory:');
  const chats = new ChatsRepo(db);
  expect(chats.mergeChat('a1', 'x@lid', 'x@lid')).toBe(0);
});

test('chatsMissingContactName lists chats with no saved name', () => {
  const db = createDb(':memory:');
  const chats = new ChatsRepo(db);
  chats.upsert('a1', { jid: 'named@lid' });
  chats.upsert('a1', { jid: 'unnamed@lid' });
  chats.upsert('a1', { jid: 'group@g.us' });
  chats.setContact('a1', 'named@lid', 'Alice');
  const missing = chats.chatsMissingContactName('a1');
  expect(missing).toContain('unnamed@lid');
  expect(missing).toContain('group@g.us');
  expect(missing).not.toContain('named@lid');
});
