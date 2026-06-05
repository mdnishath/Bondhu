import { test, expect } from 'vitest';
import { createDb } from './db.js';

test('chats and messages tables exist', () => {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO chats (account_id,jid) VALUES (?,?)').run('a1', 'j@s.whatsapp.net');
  db.prepare('INSERT INTO messages (account_id,msg_id,chat_jid,timestamp) VALUES (?,?,?,?)')
    .run('a1', 'm1', 'j@s.whatsapp.net', 1);
  const c = db.prepare('SELECT jid FROM chats WHERE account_id=?').get('a1') as any;
  const m = db.prepare('SELECT msg_id FROM messages WHERE account_id=?').get('a1') as any;
  expect(c.jid).toBe('j@s.whatsapp.net');
  expect(m.msg_id).toBe('m1');
});
