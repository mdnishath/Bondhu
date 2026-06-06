import { test, expect } from 'vitest';
import { normalizeMessage } from './normalize.js';

test('normalizes a plain text message', () => {
  const waMsg = {
    key: { id: 'ABC', remoteJid: 'c@s.whatsapp.net', fromMe: false },
    pushName: 'Alice',
    messageTimestamp: 1700,
    message: { conversation: 'hello' },
  };
  const n = normalizeMessage('a1', waMsg);
  expect(n).toEqual({
    accountId: 'a1',
    msgId: 'ABC',
    chatJid: 'c@s.whatsapp.net',
    senderJid: 'c@s.whatsapp.net',
    fromMe: false,
    type: 'text',
    body: 'hello',
    timestamp: 1700000,
    ack: 0,
  });
});

test('extracts extended text and falls back to placeholder for media', () => {
  const ext = normalizeMessage('a1', {
    key: { id: 'X', remoteJid: 'c@s.whatsapp.net', fromMe: true },
    messageTimestamp: 1,
    message: { extendedTextMessage: { text: 'hi there' } },
  });
  expect(ext!.body).toBe('hi there');
  expect(ext!.fromMe).toBe(true);

  const img = normalizeMessage('a1', {
    key: { id: 'Y', remoteJid: 'c@s.whatsapp.net', fromMe: false },
    messageTimestamp: 1,
    message: { imageMessage: { caption: 'pic' } },
  });
  expect(img!.type).toBe('image');
  expect(img!.body).toBe('pic');
});

test('returns null for messages without a key id', () => {
  expect(normalizeMessage('a1', { message: { conversation: 'x' } } as any)).toBeNull();
});

test('keeps a text that ALSO carries messageContextInfo (multi-device / @lid)', () => {
  // Modern WhatsApp attaches messageContextInfo (deviceListMetadata) to ordinary
  // incoming texts — these must NOT be dropped.
  const n = normalizeMessage('a1', {
    key: { id: 'M', remoteJid: '77859804709099@lid', fromMe: false },
    messageTimestamp: 1700,
    message: { conversation: 'How are you ?', messageContextInfo: { deviceListMetadata: {} } },
  });
  expect(n).not.toBeNull();
  expect(n!.body).toBe('How are you ?');
  expect(n!.type).toBe('text');

  // ...but a pure metadata message (messageContextInfo only) is still skipped.
  expect(
    normalizeMessage('a1', {
      key: { id: 'N', remoteJid: 'c@s.whatsapp.net', fromMe: false },
      messageTimestamp: 1,
      message: { messageContextInfo: { deviceListMetadata: {} } },
    }),
  ).toBeNull();
});
