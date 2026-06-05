import { test, expect } from 'vitest';
import { createDb } from './db.js';

test('createDb applies schema and supports CRUD', () => {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)')
    .run('u1', 'a@b.com', 'hash', 1);
  const row = db.prepare('SELECT email FROM users WHERE id=?').get('u1') as any;
  expect(row.email).toBe('a@b.com');
});
