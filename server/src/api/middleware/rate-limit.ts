import type { Request, Response, NextFunction } from 'express';
import { config } from '../../config.js';

/** Tiny dependency-free fixed-window rate limiter (per client IP + bucket).
 *  Good enough to blunt password brute-force and paid-API abuse on a single
 *  Node process. Skipped under NODE_ENV=test so the suite stays deterministic. */
export function rateLimit(opts: { windowMs: number; max: number; bucket: string }) {
  const hits = new Map<string, { count: number; reset: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (config.isTest) return next();
    // req.ip is derived by Express from X-Forwarded-For using `trust proxy` (1 hop = nginx),
    // so it is NOT spoofable the way the raw left-most XFF entry is.
    const ip = req.ip || 'unknown';
    const key = `${opts.bucket}:${ip}`;
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now > rec.reset) {
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      // Opportunistic cleanup so the map doesn't grow unbounded.
      if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
      return next();
    }
    rec.count++;
    if (rec.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((rec.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many requests, slow down.' });
    }
    next();
  };
}
