import { test, expect } from 'vitest';
import { resolveReactionSender } from './reaction.js';

test('1:1 reaction by the other person is keyed by their remoteJid', () => {
  const r = { key: { remoteJid: 'x@s.whatsapp.net', fromMe: false }, reaction: { text: '❤️' } };
  expect(resolveReactionSender(r)).toBe('x@s.whatsapp.net');
});

test('1:1 reaction by me is keyed as "me"', () => {
  const r = { key: { remoteJid: 'x@s.whatsapp.net', fromMe: true }, reaction: { text: '👍' } };
  expect(resolveReactionSender(r)).toBe('me');
});

test('group reaction by another participant is keyed by the reactor, NOT the group jid', () => {
  // The reactor lives in r.key.participant; r.key.remoteJid is the group.
  // The old code fell back to remoteJid (the group) so every reactor collided.
  const r = {
    key: { remoteJid: 'g@g.us', participant: 'reactor@s.whatsapp.net', fromMe: false },
    reaction: { text: '😂', key: { participant: 'someoneElse@s.whatsapp.net' } },
  };
  expect(resolveReactionSender(r)).toBe('reactor@s.whatsapp.net');
});

test('group reaction by me is keyed as "me"', () => {
  const r = {
    key: { remoteJid: 'g@g.us', participant: 'me@s.whatsapp.net', fromMe: true },
    reaction: { text: '🔥' },
  };
  expect(resolveReactionSender(r)).toBe('me');
});

test('missing key falls back to "unknown"', () => {
  expect(resolveReactionSender({ reaction: { text: '❤️' } })).toBe('unknown');
});
