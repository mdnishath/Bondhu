import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ChatsRepo } from './chats.repo.js';

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
