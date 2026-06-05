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

test('context exposes ai services', () => {
  const ctx = createContext(':memory:');
  expect(ctx.apiKeys).toBeTruthy();
  expect(ctx.langs).toBeTruthy();
  expect(ctx.translation).toBeTruthy();
  expect(ctx.tts).toBeTruthy();
  expect(ctx.transcription).toBeTruthy();
});
