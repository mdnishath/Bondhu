import { test, expect } from 'vitest';
import { config } from './config.js';

test('config provides defaults', () => {
  expect(config.port).toBeTypeOf('number');
  expect(config.dbPath).toContain('.db');
});
