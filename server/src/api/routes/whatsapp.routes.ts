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
    // Reuse a pending (non-connected) account if one already exists for this
    // user — revisiting the link page was creating a fresh empty row each time.
    const existing = ctx.accounts.listByUser(req.userId!).find((a) => a.status !== 'connected');
    if (existing) {
      await ctx.manager.start(existing.id, undefined);
      return res.json({ accountId: existing.id });
    }
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
    const isGroup = req.params.chatId.endsWith('@g.us');
    res.json({
      lang,
      messages: messages.map((m) => ({
        ...m,
        reactions: reactions[m.msgId] ?? [],
        translated: ctx.translation.cachedFor(accountId, m.msgId, lang) ?? null,
        transcript: m.transcript ?? null,
        senderName: isGroup && !m.fromMe && m.senderJid
          ? (ctx.chats.contactName(accountId, m.senderJid) || '+' + m.senderJid.split('@')[0])
          : undefined,
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

  r.post('/chats/:chatId/clear', (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res);
    if (!accountId) return;
    ctx.messages.clearChat(accountId, req.params.chatId);
    res.json({ success: true });
  });

  r.post('/presence/subscribe', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    await ctx.manager.subscribePresence(accountId, req.body?.jid);
    res.json({ success: true });
  });

  r.post('/presence/typing', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    await ctx.manager.sendTyping(accountId, req.body?.jid, !!req.body?.on);
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

  r.post('/delete-local', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId } = req.body ?? {};
    if (!msgId) return res.status(400).json({ error: 'msgId required' });
    try { await ctx.manager.deleteForMe(accountId, msgId); res.json({ success: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  r.post('/edit-message', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const { msgId, text } = req.body ?? {};
    if (!msgId || typeof text !== 'string') return res.status(400).json({ error: 'msgId and text required' });
    try { await ctx.manager.editMessage(accountId, msgId, text); res.json({ success: true }); }
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

  r.get('/profile', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id required' });
    const [about, phoneJid] = await Promise.all([
      ctx.manager.profileAbout(accountId, id),
      ctx.manager.resolvePhoneJid(accountId, id),
    ]);
    // Baileys returns e.g. "8801767591988:0@s.whatsapp.net" — strip the ":<device>"
    // suffix so the contact panel shows just the phone digits.
    const phone = phoneJid && phoneJid.endsWith('@s.whatsapp.net')
      ? phoneJid.split('@')[0].split(':')[0]
      : null;
    res.json({ jid: id, about, phoneJid, phone });
  });

  // Repair legacy split chats: any non-group phone-keyed chat whose `@lid` is now
  // known gets folded into its `@lid` chat so one contact = one thread. New
  // messages already canonicalize at ingest; this fixes rows stored before the
  // lid mapping was learned. Returns what was merged. Reload the client after.
  r.post('/merge-lid-chats', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const conn: any = ctx.manager.get(accountId);
    if (!conn) return res.status(409).json({ error: 'account not connected' });
    const phoneChats = ctx.db
      .prepare("SELECT jid FROM chats WHERE account_id=? AND jid LIKE '%@s.whatsapp.net'")
      .all(accountId) as Array<{ jid: string }>;
    const merged: Array<{ from: string; to: string; moved: number }> = [];
    for (const { jid } of phoneChats) {
      let lid: string;
      try { lid = await conn.canonicalJid(jid); } catch { continue; }
      if (!lid || lid === jid || !lid.endsWith('@lid')) continue;
      const moved = ctx.chats.mergeChat(accountId, jid, lid);
      merged.push({ from: jid, to: lid, moved });
      ctx.manager.emit('chat_update', accountId, lid);
    }
    res.json({ merged, count: merged.length, scanned: phoneChats.length });
  });

  // Backfill saved contact names onto `@lid` chats: WhatsApp delivers names
  // keyed by the phone jid, but chats are keyed by `@lid`, so the list shows
  // "WhatsApp user". For each unnamed @lid chat, resolve its phone and copy the
  // saved name across. New messages auto-backfill; this fixes existing chats.
  r.post('/backfill-contact-names', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const conn: any = ctx.manager.get(accountId);
    if (!conn) return res.status(409).json({ error: 'account not connected' });
    const jids = ctx.chats.chatsMissingContactName(accountId);
    let filled = 0;
    for (const jid of jids) {
      if (!jid.endsWith('@lid')) continue;
      let pn: string | null;
      try { pn = await conn.resolvePhoneJid(jid); } catch { continue; }
      const bare = pn ? pn.replace(/:\d+@/, '@') : null;
      if (!bare || !bare.endsWith('@s.whatsapp.net')) continue;
      const name = ctx.chats.contactName(accountId, bare);
      if (name) { ctx.chats.setContact(accountId, jid, name); ctx.manager.emit('chat_update', accountId, jid); filled++; }
    }
    res.json({ scanned: jids.length, filled });
  });

  r.get('/profile-pic', async (req: AuthedRequest, res) => {
    const accountId = ownAccount(req, res); if (!accountId) return;
    const id = req.query.id as string;
    if (!id) return res.status(400).end();
    const pic = await ctx.manager.profilePicBytes(accountId, id);
    if (!pic) return res.status(404).end();
    res.setHeader('Content-Type', pic.mime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(pic.data);
  });

  return r;
}
