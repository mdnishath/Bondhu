import { Router } from 'express';
import sharp from 'sharp';
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
    res.json({
      connected: acc.status === 'connected',
      state: acc.status,
      phoneNumber: acc.phone,
      qr: conn?.qr ?? null,
      pairingCode: conn?.pairingCode ?? null,
    });
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
    const reactions = ctx.manager.reactionsFor(accountId, messages.map((m) => m.msgId));
    const lang = ctx.langs.resolve(req.userId!, accountId, req.params.chatId);
    res.json({
      lang,
      messages: messages.map((m) => ({
        ...m,
        reactions: reactions[m.msgId] ?? [],
        translated: ctx.translation.cachedFor(accountId, m.msgId, lang) ?? null,
      })),
    });
  });

  r.post('/send', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    const { chatId, message, translateTo } = req.body ?? {};
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
    try {
      // Outgoing translation: rewrite the user's text into the recipient's
      // language before sending (e.g. type in Banglish, send in French).
      let outText = message as string;
      let original: string | undefined;
      if (translateTo && typeof translateTo === 'string') {
        original = message;
        outText = await ctx.translation.translateOutgoing(req.userId!, message, translateTo);
      }
      const msgId = await ctx.manager.sendText(accountId, chatId, outText);
      res.json({ success: true, msgId, sentText: outText, original });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/chats/:chatId/mark-read', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    await ctx.manager.markRead(accountId, req.params.chatId);
    res.json({ success: true });
  });

  r.post('/react', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId, emoji } = req.body ?? {};
    try { await ctx.manager.react(accountId, msgId, emoji ?? ''); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/reply', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, msgId, text } = req.body ?? {};
    try { const id = await ctx.manager.reply(accountId, chatId, msgId, text); res.json({ success: true, msgId: id }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/delete-message', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId } = req.body ?? {};
    try { await ctx.manager.deleteForEveryone(accountId, msgId); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/forward', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgIds, targetChatIds } = req.body ?? {};
    try { const n = await ctx.manager.forward(accountId, msgIds ?? [], targetChatIds ?? []); res.json({ success: true, forwarded: n }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/send-image', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, imageBase64, caption } = req.body ?? {};
    if (!chatId || !imageBase64) return res.status(400).json({ error: 'chatId and imageBase64 required' });
    try {
      const input = Buffer.from(imageBase64, 'base64');
      const jpeg = await sharp(input).resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
      const id = await ctx.manager.sendImage(accountId, chatId, jpeg, caption);
      res.json({ success: true, msgId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/send-recorded', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { chatId, audioBase64 } = req.body ?? {};
    if (!chatId || !audioBase64) return res.status(400).json({ error: 'chatId and audioBase64 required' });
    try {
      const buf = Buffer.from(audioBase64, 'base64');
      const id = await ctx.manager.sendVoice(accountId, chatId, buf);
      res.json({ success: true, msgId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.get('/media/:msgId', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    try {
      const { buffer, mime } = await ctx.manager.downloadMedia(accountId, req.params.msgId);
      res.setHeader('Content-Type', mime);
      res.send(buffer);
    } catch (e: any) {
      // Own sent voice notes aren't downloadable from WhatsApp — serve the
      // TTS audio we stored at send time so the sender can replay them.
      const own = ctx.tts.getForMsg(accountId, req.params.msgId);
      if (own) { res.setHeader('Content-Type', own.mime); return res.send(Buffer.from(own.audioBase64, 'base64')); }
      res.status(404).json({ error: e.message });
    }
  });

  r.get('/profile-pic', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const id = req.query.id as string;
    res.json({ id, url: await ctx.manager.profilePic(accountId, id) });
  });

  return r;
}
