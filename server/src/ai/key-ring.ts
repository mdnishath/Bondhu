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
        lastErr = e;
        const httpStatus = typeof e?.status === 'number' ? e.status : NaN;
        // Rotate on quota (429), server errors (5xx), and 403 — a 403
        // API_KEY_SERVICE_BLOCKED means this key isn't allowed to call this
        // service, so another key (scoped to a different service) may succeed.
        const httpRetryable = httpStatus === 429 || httpStatus === 403 || (httpStatus >= 500 && httpStatus < 600);
        // No numeric HTTP status = a transport error (ECONNRESET / DNS / timeout /
        // "fetch failed") — transient, so try the next key instead of giving up.
        const isTransport = !Number.isFinite(httpStatus);
        if (httpRetryable || isTransport) continue;
        throw e; // genuine non-retryable HTTP error (e.g. 400 bad request)
      }
    }
    throw lastErr;
  }
}
