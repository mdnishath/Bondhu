import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { MessagesRepo } from './messages.repo.js';

test('upsert is idempotent and list returns newest-first within a chat', () => {
  const repo = new MessagesRepo(createDb(':memory:'));
  const base = { accountId: 'a1', chatJid: 'c@s.whatsapp.net', senderJid: 's', fromMe: false, type: 'text' };
  repo.upsert({ ...base, msgId: 'm1', body: 'one', timestamp: 100, ack: 0 });
  repo.upsert({ ...base, msgId: 'm2', body: 'two', timestamp: 200, ack: 0 });
  repo.upsert({ ...base, msgId: 'm1', body: 'one', timestamp: 100, ack: 0 }); // dup
  const list = repo.listByChat('a1', 'c@s.whatsapp.net', 10);
  expect(list).toHaveLength(2);
  expect(list[0].msgId).toBe('m2');
  repo.setAck('a1', 'm2', 3);
  expect(repo.listByChat('a1', 'c@s.whatsapp.net', 10).find((m) => m.msgId === 'm2')?.ack).toBe(3);
});

test('stores raw json, getById, and markDeleted', () => {
  const repo = new MessagesRepo(createDb(':memory:'));
  repo.upsert({ accountId: 'a1', msgId: 'm1', chatJid: 'c', senderJid: 's', fromMe: false, type: 'image', body: '[image]', timestamp: 1, ack: 0, raw: '{"x":2}' });
  expect(repo.getRaw('a1', 'm1')).toBe('{"x":2}');
  expect(repo.getRaw('a1', 'missing')).toBeUndefined();
  expect(repo.getById('a1', 'm1')?.type).toBe('image');
  repo.markDeleted('a1', 'm1');
  expect(repo.getById('a1', 'm1')?.type).toBe('deleted');
  expect(repo.getById('a1', 'm1')?.body).toBe('[deleted]');
});
