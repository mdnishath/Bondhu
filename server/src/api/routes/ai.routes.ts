import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { SUPPORTED_LANGS, isSupportedLang } from '../../ai/langs.js';

export function aiRoutes(ctx: AppContext): Router {
  const r = Router();
  r.use(requireAuth(ctx));

  // --- API keys ---
  r.get('/settings/keys', (req: AuthedRequest, res) => res.json({ keys: ctx.apiKeys.list(req.userId!) }));
  r.post('/settings/keys', (req: AuthedRequest, res) => {
    const { keyValue, label } = req.body ?? {};
    if (!keyValue) return res.status(400).json({ error: 'keyValue required' });
    res.json(ctx.apiKeys.add(req.userId!, keyValue, label));
  });
  r.delete('/settings/keys/:id', (req: AuthedRequest, res) => { ctx.apiKeys.remove(req.userId!, req.params.id); res.json({ success: true }); });
  r.post('/settings/keys/:id/activate', (req: AuthedRequest, res) => { ctx.apiKeys.activate(req.userId!, req.params.id); res.json({ success: true }); });

  // --- Language ---
  r.get('/settings/language', (req: AuthedRequest, res) =>
    res.json({ lang: ctx.langs.getGlobal(req.userId!), supported: SUPPORTED_LANGS.map((l) => ({ code: l.code, name: l.name })) }));
  r.post('/settings/language', (req: AuthedRequest, res) => {
    const { lang } = req.body ?? {};
    if (!isSupportedLang(lang)) return res.status(400).json({ error: 'unsupported lang' });
    ctx.langs.setGlobal(req.userId!, lang); res.json({ success: true });
  });
  r.get('/chats/:chatId/language', (req: AuthedRequest, res) => {
    const accountId = req.query.account as string;
    res.json({ lang: ctx.langs.getChat(req.userId!, accountId, req.params.chatId) ?? null });
  });
  r.post('/chats/:chatId/language', (req: AuthedRequest, res) => {
    const accountId = req.query.account as string;
    const { lang } = req.body ?? {};
    if (lang === null) { ctx.langs.clearChat(req.userId!, accountId, req.params.chatId); return res.json({ success: true }); }
    if (!isSupportedLang(lang)) return res.status(400).json({ error: 'unsupported lang' });
    ctx.langs.setChat(req.userId!, accountId, req.params.chatId, lang); res.json({ success: true });
  });

  const account = (req: AuthedRequest, res: any): string | null => {
    const a = (req.query.account as string) || (req.body?.account as string);
    if (!a || !ctx.accounts.isOwnedByUser(a, req.userId!)) { res.status(403).json({ error: 'forbidden' }); return null; }
    return a;
  };

  // --- On-demand translate (incoming text) ---
  r.post('/retranslate', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { msgId, text, chatId } = req.body ?? {};
    const lang = ctx.langs.resolve(req.userId!, acc, chatId ?? '');
    try { res.json({ translated: await ctx.translation.translate(req.userId!, acc, msgId, text, lang), lang }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- TTS for a stored message body ---
  r.post('/tts', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { msgId, text, lang } = req.body ?? {};
    const useLang = isSupportedLang(lang) ? lang : ctx.langs.getGlobal(req.userId!);
    try { res.json(await ctx.tts.synthesize(req.userId!, acc, msgId, text, useLang)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Re-transcribe an incoming voice note ---
  r.post('/retranscribe', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { msgId } = req.body ?? {};
    try {
      const { buffer, mime } = await ctx.manager.downloadMedia(acc, msgId);
      const text = await ctx.transcription.transcribe(req.userId!, buffer.toString('base64'), mime);
      res.json({ transcript: text });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Text -> voice send (TTS then send as ptt) ---
  r.post('/send-voice', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { chatId, text, language } = req.body ?? {};
    const lang = isSupportedLang(language) ? language : ctx.langs.getGlobal(req.userId!);
    try {
      const tts = await ctx.tts.synthesize(req.userId!, acc, `tts-${chatId}-${text.length}`, text, lang);
      const id = await ctx.manager.sendVoice(acc, chatId, Buffer.from(tts.audioBase64, 'base64'));
      res.json({ success: true, msgId: id });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return r;
}
