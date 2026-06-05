import { test, expect } from 'vitest';
import { createContext } from './app-context.js';

test('context exposes services', () => {
  const ctx = createContext(':memory:');
  expect(ctx.auth).toBeTruthy();
  expect(ctx.users).toBeTruthy();
});
