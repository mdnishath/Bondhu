import type { Request, Response, NextFunction } from 'express';
import type { AppContext } from '../../app-context.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(ctx: AppContext) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer ?? (req.query.token as string | undefined);
    if (!token) return res.status(401).json({ error: 'Authorization token required' });
    try {
      req.userId = ctx.auth.verifyToken(token).userId;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
