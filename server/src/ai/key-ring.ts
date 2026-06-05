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
        // Rotate on quota (429), server errors (5xx), and 403 — a 403
        // API_KEY_SERVICE_BLOCKED means this key isn't allowed to call this
        // service, so another key (scoped to a different service) may succeed.
        if (status === 429 || status === 403 || (status >= 500 && status < 600)) continue;
        throw e; // non-retryable (e.g. 400 bad request)
      }
    }
    throw lastErr;
  }
}
