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
