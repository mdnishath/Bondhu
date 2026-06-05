import { test, expect } from 'vitest';
import { createDb } from '../db.js';
import { ReactionsRepo } from './reactions.repo.js';

test('set, replace, remove, and list reactions per message', () => {
  const repo = new ReactionsRepo(createDb(':memory:'));
  repo.set('a1', 'm1', 's1', '❤️', false);
  repo.set('a1', 'm1', 's2', '👍', false);
  expect(repo.listForMessage('a1', 'm1')).toHaveLength(2);
  repo.set('a1', 'm1', 's1', '😂', false); // replace s1's reaction
  const list = repo.listForMessage('a1', 'm1');
  expect(list.find((r) => r.senderJid === 's1')?.emoji).toBe('😂');
  repo.set('a1', 'm1', 's1', '', false); // empty removes
  expect(repo.listForMessage('a1', 'm1')).toHaveLength(1);
});

test('listForChat groups by msg id', () => {
  const repo = new ReactionsRepo(createDb(':memory:'));
  repo.set('a1', 'm1', 's1', '❤️', false);
  repo.set('a1', 'm2', 's1', '👍', false);
  const grouped = repo.listForChat('a1', ['m1', 'm2', 'm3']);
  expect(grouped['m1'][0].emoji).toBe('❤️');
  expect(grouped['m3']).toBeUndefined();
});
