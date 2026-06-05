import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export function authRoutes(ctx: AppContext): Router {
  const r = Router();

  r.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body ?? {};
      res.json(await ctx.auth.register(email, password, name));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      res.json(await ctx.auth.login(email, password));
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  });

  r.get('/me', requireAuth(ctx), (req: AuthedRequest, res) => {
    const user = ctx.users.findById(req.userId!);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ id: user.id, email: user.email, name: user.name });
  });

  return r;
}
