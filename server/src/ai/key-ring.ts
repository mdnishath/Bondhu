import type { ApiKeysRepo } from '../db/repositories/api-keys.repo.js';

/** Runs an API call with the user's keys, rotating to the next key on 429/5xx. */
export class KeyRing {
  constructor(private keys: ApiKeysRepo) {}

  async run<T>(userId: string, fn: (key: string) => Promise<T>): Promise<T> {
    const all = this.keys.allKeys(userId);
    if (all.length === 0) throw new Error('No API key configured');
    let lastErr: any;
    for (const key of all) {
      try {
        return await fn(key);
      } catch (e: any) {
        const status = e?.status ?? e?.code;
        lastErr = e;
        if (status === 429 || (status >= 500 && status < 600)) continue; // rotate
        throw e; // non-retryable
      }
    }
    throw lastErr;
  }
}
