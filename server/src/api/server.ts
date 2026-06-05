import express, { type Express } from 'express';
import cors from 'cors';
import type { AppContext } from '../app-context.js';
import { authRoutes } from './routes/auth.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { aiRoutes } from './routes/ai.routes.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(ctx));
  app.use('/api', whatsappRoutes(ctx));
  app.use('/api', aiRoutes(ctx));
  return app;
}
