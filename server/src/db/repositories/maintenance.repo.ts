import type { DB } from '../db.js';

/**
 * Housekeeping for the regenerable caches that otherwise grow without bound on a
 * long-lived live account (the TTS cache in particular stores base64 WAV blobs).
 * Everything pruned here can be re-derived on demand — translations re-translate,
 * TTS re-synthesizes, profile pics re-fetch — so age-based pruning is lossless.
 * Chat history (messages/reactions) is deliberately NOT touched.
 */
export class MaintenanceRepo {
  constructor(private db: DB) {}

  /** Delete cache rows older than `cutoffMs` (epoch ms). Returns deleted counts. */
  pruneOldCaches(cutoffMs: number): { translations: number; tts: number; profilePics: number } {
    const t = this.db.prepare('DELETE FROM translations WHERE created_at < ?').run(cutoffMs);
    const tts = this.db.prepare('DELETE FROM tts_cache WHERE created_at < ?').run(cutoffMs);
    const pp = this.db.prepare('DELETE FROM profile_pics WHERE fetched_at < ?').run(cutoffMs);
    return { translations: t.changes, tts: tts.changes, profilePics: pp.changes };
  }
}
