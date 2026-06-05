import express, { type Express } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppContext } from '../app-context.js';
import { authRoutes } from './routes/auth.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { aiRoutes } from './routes/ai.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// web/public lives at repo-root/web/public; server src is repo-root/server/src/api
const WEB_DIR = path.resolve(__dirname, '../../../web/public');

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api', whatsappRoutes(ctx));
  app.use('/api', aiRoutes(ctx));
  // Serve the Bondhu web client (same-origin, after API routes so /api wins).
  app.use(express.static(WEB_DIR));
  app.get('/', (_req, res) => res.redirect('/login.html'));
  return app;
}
