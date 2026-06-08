import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppContext } from '../app-context.js';
import { config } from '../config.js';
import { authRoutes } from './routes/auth.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { rateLimit } from './middleware/rate-limit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built React SPA lives at repo-root/web/dist; server src is repo-root/server/src/api
const WEB_DIR = path.resolve(__dirname, '../../../web/dist');

// Routes that legitimately carry large base64 media payloads.
const MEDIA_PATHS = ['/api/send-image', '/api/send-recorded', '/api/transcribe', '/api/send-voice', '/api/send-document'];
// Paid-API (Gemini) endpoints — moderate per-IP limit to cap cost/abuse.
const AI_PATHS = ['/api/transcribe', '/api/tts', '/api/send-voice', '/api/retranscribe', '/api/retranslate'];

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.set('trust proxy', 1); // behind nginx — use X-Forwarded-For for client IP

  // CORS: allowlist browser origins; native apps / curl (no Origin) always pass.
  app.use(cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false); // unknown origin: no CORS headers (browser blocks the read)
    },
  }));

  // Tiered body limits: big only on media routes (documents/APKs can be large),
  // small everywhere else (incl. auth).
  app.use(MEDIA_PATHS, express.json({ limit: '100mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Rate limits (skipped under NODE_ENV=test).
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 30, bucket: 'auth' }));
  app.use(AI_PATHS, rateLimit({ windowMs: 60_000, max: 30, bucket: 'ai' }));

  app.use('/api/auth', authRoutes(ctx));
  app.use('/api', whatsappRoutes(ctx));
  app.use('/api', aiRoutes(ctx));
  // Serve the built Bondhu React SPA (same-origin, after API routes so /api wins).
  app.use(express.static(WEB_DIR));
  // SPA fallback: any non-API GET serves index.html so client-side routing works.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

  // Terminal error handler: turns unhandled route throws into a 500 instead of a
  // hung request (Express 4 doesn't catch async throws on its own).
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    process.stderr.write(`[Bondhu] route error: ${err?.stack || err?.message || err}\n`);
    if (res.headersSent) return;
    res.status(err?.status || 500).json({ error: err?.message || 'internal error' });
  });
  return app;
}
