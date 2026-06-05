import { test, expect } from 'vitest';
import { SUPPORTED_LANGS, isSupportedLang, langName } from './langs.js';

test('supported langs include bn + en and validate', () => {
  expect(SUPPORTED_LANGS.length).toBeGreaterThan(10);
  expect(isSupportedLang('bn')).toBe(true);
  expect(isSupportedLang('xx')).toBe(false);
  expect(langName('bn')).toBe('Bengali');
});
