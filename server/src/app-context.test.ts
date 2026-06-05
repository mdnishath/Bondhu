import { test, expect } from 'vitest';
import { createContext } from './app-context.js';

test('context exposes services', () => {
  const ctx = createContext(':memory:');
  expect(ctx.auth).toBeTruthy();
  expect(ctx.users).toBeTruthy();
});

test('context exposes whatsapp layer', () => {
  const ctx = createContext(':memory:');
  expect(ctx.accounts).toBeTruthy();
  expect(ctx.chats).toBeTruthy();
  expect(ctx.messages).toBeTruthy();
  expect(ctx.manager).toBeTruthy();
});
