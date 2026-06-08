import { Router } from 'express';
import type { AppContext } from '../../app-context.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { SUPPORTED_LANGS, isSupportedLang } from '../../ai/langs.js';
import { wavToOpus } from '../../ai/transcode.js';

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

  // Resolve + authorize the ?account= (or body.account) param against the caller.
  // 400 when missing, 403 when the account isn't owned by this user.
  const account = (req: AuthedRequest, res: any): string | null => {
    const a = (req.query.account as string) || (req.body?.account as string);
    if (!a) { res.status(400).json({ error: 'account required' }); return null; }
    if (!ctx.accounts.isOwnedByUser(a, req.userId!)) { res.status(403).json({ error: 'forbidden' }); return null; }
    return a;
  };

  // --- Language ---
  r.get('/settings/language', (req: AuthedRequest, res) =>
    res.json({ lang: ctx.langs.getGlobal(req.userId!), supported: SUPPORTED_LANGS.map((l) => ({ code: l.code, name: l.name, flag: l.flag })) }));
  r.post('/settings/language', (req: AuthedRequest, res) => {
    const { lang } = req.body ?? {};
    if (!isSupportedLang(lang)) return res.status(400).json({ error: 'unsupported lang' });
    ctx.langs.setGlobal(req.userId!, lang); res.json({ success: true });
  });
  // Per-chat language is per-account state — must be ownership-checked (was IDOR).
  r.get('/chats/:chatId/language', (req: AuthedRequest, res) => {
    const accountId = account(req, res); if (!accountId) return;
    res.json({ lang: ctx.langs.getChat(req.userId!, accountId, req.params.chatId) ?? null });
  });
  r.post('/chats/:chatId/language', (req: AuthedRequest, res) => {
    const accountId = account(req, res); if (!accountId) return;
    const { lang } = req.body ?? {};
    if (lang === null) { ctx.langs.clearChat(req.userId!, accountId, req.params.chatId); return res.json({ success: true }); }
    if (!isSupportedLang(lang)) return res.status(400).json({ error: 'unsupported lang' });
    ctx.langs.setChat(req.userId!, accountId, req.params.chatId, lang); res.json({ success: true });
  });

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

  // --- Transcribe a freshly recorded clip (mic) to text ---
  r.post('/transcribe', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { audioBase64, mimeType } = req.body ?? {};
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
    try {
      // Browser recordings are webm/opus; transcode to ogg/opus (Gemini-friendly).
      const ogg = await wavToOpus(Buffer.from(audioBase64, 'base64'));
      const transcript = await ctx.transcription.transcribe(req.userId!, ogg.toString('base64'), 'audio/ogg');
      res.json({ transcript });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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

  // --- Text -> translated voice note + text (composer voice mode) ---
  r.post('/send-voice', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { chatId, message, translateTo } = req.body ?? {};
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
    try {
      const willTranslate = isSupportedLang(translateTo);
      const lang = willTranslate ? translateTo : ctx.langs.getGlobal(req.userId!);
      const sentText = willTranslate
        ? await ctx.translation.translateOutgoing(req.userId!, message, translateTo)
        : message;
      const ttsKey = `tts-out-${chatId}-${Buffer.from(sentText).toString('base64url')}`;
      const tts = await ctx.tts.synthesize(req.userId!, acc, ttsKey, sentText, lang);
      const ogg = await wavToOpus(Buffer.from(tts.audioBase64, 'base64'));
      // Voice goes first. If the text send fails AFTER the voice is delivered,
      // don't fail the whole request (that would make the client retry and
      // double-send the voice) — report the voice id with textMsgId: null.
      const voiceMsgId = await ctx.manager.sendVoice(acc, chatId, ogg);
      // Keep the audio under the real message id so the sender can replay their
      // own voice note via /media (own outgoing media isn't fetchable from WA).
      if (voiceMsgId) ctx.tts.putForMsg(acc, voiceMsgId, { audioBase64: tts.audioBase64, mime: tts.mime });
      let textMsgId: string | null = null;
      try { textMsgId = await ctx.manager.sendText(acc, chatId, sentText); }
      catch { /* voice already delivered; report partial success */ }
      res.json({
        success: true, voiceMsgId, textMsgId,
        sentText, original: willTranslate ? message : undefined,
        audioBase64: tts.audioBase64, mime: tts.mime,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  return r;
}
