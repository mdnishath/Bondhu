import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export function whatsappRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth(ctx));

  // resolve + authorize the ?account= param against the caller
  const ownAccount = (req: AuthedRequest, res: any): string | null => {
    const accountId = (req.query.account as string) || (req.body?.account as string);
    if (!accountId) {
      res.status(400).json({ error: 'account required' });
      return null;
    }
    if (!ctx.accounts.isOwnedByUser(accountId, req.userId!)) {
      res.status(403).json({ error: 'forbidden' });
      return null;
    }
    return accountId;
  };

  r.get('/accounts', (req: AuthedRequest, res) => {
    const accounts = ctx.accounts.listByUser(req.userId!).map((a) => {
      const conn = ctx.manager.get(a.id);
      return { id: a.id, label: a.label, phone: a.phone, status: a.status, qr: conn?.qr ?? null };
    });
    res.json({ accounts });
  });

  r.post('/accounts', async (req: AuthedRequest, res) => {
    const acc = ctx.accounts.create({ userId: req.userId!, label: req.body?.label });
    await ctx.manager.start(acc.id, undefined);
    res.json({ accountId: acc.id });
  });

  r.post('/accounts/:id/pair', async (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!ctx.accounts.isOwnedByUser(id, req.userId!)) return res.status(403).json({ error: 'forbidden' });
    const phone = String(req.body?.phone ?? '').replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: 'phone required' });
    await ctx.manager.stop(id);
    await ctx.manager.start(id, phone);
    res.json({ success: true });
  });

  r.delete('/accounts/:id', async (req: AuthedRequest, res) => {
    const id = req.params.id;
    if (!ctx.accounts.isOwnedByUser(id, req.userId!)) return res.status(403).json({ error: 'forbidden' });
    await ctx.manager.stop(id);
    ctx.accounts.remove(id);
    res.json({ success: true });
  });

  r.get('/status', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const acc = ctx.accounts.findById(accountId)!;
    const conn = ctx.manager.get(accountId);
    res.json({ connected: acc.status === 'connected', state: acc.status, phoneNumber: acc.phone, qr: conn?.qr ?? null });
  });

  r.get('/chats', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const limit = Number(req.query.limit ?? 30);
    const offset = Number(req.query.offset ?? 0);
    res.json({ chats: ctx.chats.list(accountId, limit, offset) });
  });

  r.get('/messages/:chatId', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const limit = Number(req.query.limit ?? 50);
    const before = req.query.before ? Number(req.query.before) : undefined;
    const messages = ctx.messages.listByChat(accountId, req.params.chatId, limit, before);
    res.json({ messages });
  });

  r.post('/send', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const { chatId, message } = req.body ?? {};
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
    try {
      const msgId = await ctx.manager.sendText(accountId, chatId, message);
      res.json({ success: true, msgId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/chats/:chatId/mark-read', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    ctx.chats.clearUnread(accountId, req.params.chatId);
    res.json({ success: true });
  });

  return r;
}
