import { test, expect } from 'vitest';
import { createDb } from '../db/db.js';
import { useSqliteAuthState } from './auth-state.js';

test('persists creds and signal keys across reloads', async () => {
  const db = createDb(':memory:');
  const a = await useSqliteAuthState(db, 'acc1');
  expect(a.state.creds).toBeTruthy();
  await a.state.keys.set({ 'pre-key': { '1': { public: new Uint8Array([1, 2, 3]) } as any } });
  await a.saveCreds();

  const b = await useSqliteAuthState(db, 'acc1');
  const got = await b.state.keys.get('pre-key', ['1']);
  expect(got['1']).toBeTruthy();
  expect(b.state.creds.registrationId).toBe(a.state.creds.registrationId);
});

test('isolates keys per account', async () => {
  const db = createDb(':memory:');
  const a = await useSqliteAuthState(db, 'accA');
  await a.state.keys.set({ session: { 's1': { foo: 1 } as any } });
  const other = await useSqliteAuthState(db, 'accB');
  const got = await other.state.keys.get('session', ['s1']);
  expect(got['s1']).toBeUndefined();
});
