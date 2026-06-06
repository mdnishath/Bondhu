# Composer Send-Mode (Text/Voice) + Translating Loader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Text/Voice send-mode toggle (with country flag + icon) to the composer — text mode sends translated text (current), voice mode sends a Gemini-voiced WhatsApp voice note **plus** the translated text — and replace the bare `…translating…` text with an animated loader.

**Architecture:** Voice mode calls an enhanced `POST /api/send-voice` that translates → Gemini TTS (WAV) → ffmpeg transcode to OGG/Opus → sends a `ptt` voice note then the text; the response also returns the WAV so the sender's own bubble plays locally. The composer keeps `sendMode` per chat (like `outLang`); flags come from the language API.

**Tech Stack:** Node + TS (Express, better-sqlite3, vitest), ffmpeg (libopus) via `child_process.spawn`, React + Vite + Tailwind.

**Spec:** [docs/specs/2026-06-06-composer-send-mode-design.md](../specs/2026-06-06-composer-send-mode-design.md)

---

### Task 1: Install & verify ffmpeg on the host

**Files:** none (host environment). Prerequisite for transcoding.

- [ ] **Step 1: Check whether ffmpeg already exists**

Run (PowerShell): `ffmpeg -version`
Expected: either a version banner (done — skip to Step 3) or "not recognized".

- [ ] **Step 2: Install ffmpeg via winget**

Run (PowerShell): `winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements`
If winget is unavailable, download a static build from https://www.gyan.dev/ffmpeg/builds/ (ffmpeg-release-essentials.zip), unzip, and add its `bin` to PATH (or set `FFMPEG_PATH` to the full `ffmpeg.exe` path).

- [ ] **Step 3: Verify ffmpeg + libopus in a fresh shell**

Run (PowerShell): `ffmpeg -hide_banner -encoders | Select-String opus`
Expected: a line containing `libopus`. If `ffmpeg` is found but only after a new shell, restart the `npm run dev` server so it inherits the updated PATH.

No commit (environment change only).

---

### Task 2: Audio transcode utility (WAV → OGG/Opus)

**Files:**
- Create: `server/src/ai/transcode.ts`
- Test: `server/src/ai/transcode.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/src/ai/transcode.test.ts
import { test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { wavToOpus } from './transcode.js';

const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version']).status === 0;

// Minimal PCM16 mono WAV builder (test-local; mirrors tts.service's header).
function wav(pcm: Buffer, rate = 24000, ch = 1): Buffer {
  const bps = 16, byteRate = (rate * ch * bps) / 8, blockAlign = (ch * bps) / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(byteRate, 28); h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bps, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

test.skipIf(!hasFfmpeg)('wavToOpus returns a non-empty OGG/Opus buffer', async () => {
  const pcm = Buffer.alloc((24000 * 2) / 5); // 200ms of silence
  const ogg = await wavToOpus(wav(pcm));
  expect(ogg.length).toBeGreaterThan(0);
  expect(ogg.slice(0, 4).toString('ascii')).toBe('OggS');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "E:/New Whatsapp/server" && npx vitest run src/ai/transcode.test.ts`
Expected: FAIL — `Failed to resolve import "./transcode.js"` (module doesn't exist yet). (If ffmpeg is absent the test reports as skipped — install it per Task 1 first.)

- [ ] **Step 3: Write the implementation**

```ts
// server/src/ai/transcode.ts
import { spawn } from 'child_process';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

/**
 * Transcode an ffmpeg-readable audio buffer (we feed WAV/PCM16 from Gemini TTS)
 * into OGG/Opus, the format WhatsApp voice notes (ptt) require. Single
 * responsibility: container/codec conversion — no knowledge of WhatsApp or TTS.
 */
export function wavToOpus(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-c:a', 'libopus', '-b:a', '24k',
      '-f', 'ogg', 'pipe:1',
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ff.stdout.on('data', (d) => out.push(d as Buffer));
    ff.stderr.on('data', (d) => err.push(d as Buffer));
    ff.on('error', (e) => reject(new Error(`ffmpeg spawn failed (is it on PATH? set FFMPEG_PATH): ${e.message}`)));
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString().slice(-300)}`));
      const buf = Buffer.concat(out);
      if (buf.length === 0) return reject(new Error('ffmpeg produced empty output'));
      resolve(buf);
    });
    ff.stdin.on('error', () => { /* ignore EPIPE if ffmpeg exits early */ });
    ff.stdin.write(input);
    ff.stdin.end();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "E:/New Whatsapp/server" && npx vitest run src/ai/transcode.test.ts`
Expected: PASS (1 test). If it shows "skipped", ffmpeg is not visible to this shell — fix Task 1.

- [ ] **Step 5: Commit**

```bash
cd "E:/New Whatsapp"
git add server/src/ai/transcode.ts server/src/ai/transcode.test.ts
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat(server): wavToOpus transcode util (ffmpeg libopus) for WA voice notes" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Enhance `/send-voice` to translate → TTS → transcode → voice + text

**Files:**
- Modify: `server/src/api/routes/ai.routes.ts` (the `/send-voice` route, currently ~lines 75-85; add the `wavToOpus` import near line 4)
- Test: `server/src/api/ai.routes.test.ts` (add a test + a `vi.mock` for transcode at top)

- [ ] **Step 1: Write the failing test**

Add to the TOP of `server/src/api/ai.routes.test.ts` (after the existing imports), so the route's `wavToOpus` is mocked (no real ffmpeg in unit tests):

```ts
vi.mock('../ai/transcode.js', () => ({
  wavToOpus: vi.fn(async () => Buffer.from('OggS-fake-opus')),
}));
```

Add this test at the end of the file:

```ts
test('send-voice translates, transcodes, sends voice then text', async () => {
  const { ctx, app, token } = await authed();
  const H = { Authorization: `Bearer ${token}` };
  ctx.translation.translateOutgoing = vi.fn(async () => 'Comment vas-tu ?') as any;
  ctx.tts.synthesize = vi.fn(async () => ({ audioBase64: 'QUJD', mime: 'audio/wav' })) as any;
  ctx.manager.sendVoice = vi.fn(async () => 'v1') as any;
  ctx.manager.sendText = vi.fn(async () => 't1') as any;
  const created = await request(app).post('/api/accounts').set(H).send({});
  const acc = created.body.accountId;

  const res = await request(app).post(`/api/send-voice?account=${acc}`).set(H)
    .send({ chatId: 'c1', message: 'tumi kemon acho', translateTo: 'fr' });

  expect(res.status).toBe(200);
  expect(ctx.translation.translateOutgoing).toHaveBeenCalled();
  expect(ctx.manager.sendVoice).toHaveBeenCalled();
  expect(ctx.manager.sendText).toHaveBeenCalledWith(acc, 'c1', 'Comment vas-tu ?');
  expect(res.body).toMatchObject({
    success: true, voiceMsgId: 'v1', textMsgId: 't1',
    sentText: 'Comment vas-tu ?', original: 'tumi kemon acho',
    audioBase64: 'QUJD', mime: 'audio/wav',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "E:/New Whatsapp/server" && npx vitest run src/api/ai.routes.test.ts`
Expected: FAIL — the new test gets 500/400 or wrong body because the route still expects `{ text, language }` and doesn't translate/transcode/sendText.

- [ ] **Step 3: Add the import**

In `server/src/api/routes/ai.routes.ts`, add after line 4:

```ts
import { wavToOpus } from '../../ai/transcode.js';
```

- [ ] **Step 4: Replace the `/send-voice` route**

Replace the existing `r.post('/send-voice', ...)` block with:

```ts
  // --- Text -> translated voice note + text (composer voice mode) ---
  r.post('/send-voice', async (req: AuthedRequest, res) => {
    const acc = account(req, res); if (!acc) return;
    const { chatId, message, translateTo } = req.body ?? {};
    if (!chatId || !message) return res.status(400).json({ error: 'chatId and message required' });
    try {
      const lang = isSupportedLang(translateTo) ? translateTo : ctx.langs.getGlobal(req.userId!);
      const sentText = (translateTo && typeof translateTo === 'string')
        ? await ctx.translation.translateOutgoing(req.userId!, message, translateTo)
        : message;
      const tts = await ctx.tts.synthesize(req.userId!, acc, `tts-out-${chatId}-${sentText.length}`, sentText, lang);
      const ogg = await wavToOpus(Buffer.from(tts.audioBase64, 'base64'));
      const voiceMsgId = await ctx.manager.sendVoice(acc, chatId, ogg);
      const textMsgId = await ctx.manager.sendText(acc, chatId, sentText);
      res.json({
        success: true, voiceMsgId, textMsgId,
        sentText, original: translateTo ? message : undefined,
        audioBase64: tts.audioBase64, mime: tts.mime,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
```

- [ ] **Step 5: Run the full server suite**

Run: `cd "E:/New Whatsapp/server" && npm test`
Expected: PASS — all tests green (49 now: the new send-voice test added).

- [ ] **Step 6: Commit**

```bash
cd "E:/New Whatsapp"
git add server/src/api/routes/ai.routes.ts server/src/api/ai.routes.test.ts
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat(server): /send-voice translates -> Gemini TTS -> opus voice note + text" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add country `flag` to languages + expose via API

**Files:**
- Modify: `server/src/ai/langs.ts` (interface + every entry)
- Modify: `server/src/api/routes/ai.routes.ts:22` (include `flag` in `supported`)
- Modify: `server/src/ai/langs.test.ts` (assert flags present)
- Modify: `web/src/lib/types.ts` (`LangOption.flag`)

- [ ] **Step 1: Write the failing test (backend)**

Add to `server/src/ai/langs.test.ts`:

```ts
test('every supported lang has a flag emoji', () => {
  for (const l of SUPPORTED_LANGS) expect(l.flag, l.code).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "E:/New Whatsapp/server" && npx vitest run src/ai/langs.test.ts`
Expected: FAIL — `Property 'flag' does not exist on type 'Lang'` (type error) / undefined.

- [ ] **Step 3: Add `flag` to the interface and every entry**

Replace the interface + array in `server/src/ai/langs.ts` (lines 1-22) with:

```ts
export interface Lang { code: string; name: string; flag: string; ttsVoice: string; ttsLocale: string; }

export const SUPPORTED_LANGS: Lang[] = [
  { code: 'bn', name: 'Bengali', flag: '🇧🇩', ttsLocale: 'bn-IN', ttsVoice: 'bn-IN-Chirp3-HD-Achernar' },
  { code: 'en', name: 'English', flag: '🇺🇸', ttsLocale: 'en-US', ttsVoice: 'en-US-Chirp3-HD-Achernar' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', ttsLocale: 'hi-IN', ttsVoice: 'hi-IN-Chirp3-HD-Achernar' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦', ttsLocale: 'ar-XA', ttsVoice: 'ar-XA-Chirp3-HD-Achernar' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰', ttsLocale: 'ur-IN', ttsVoice: 'ur-IN-Standard-A' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸', ttsLocale: 'es-US', ttsVoice: 'es-US-Chirp3-HD-Achernar' },
  { code: 'fr', name: 'French', flag: '🇫🇷', ttsLocale: 'fr-FR', ttsVoice: 'fr-FR-Chirp3-HD-Achernar' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷', ttsLocale: 'pt-BR', ttsVoice: 'pt-BR-Chirp3-HD-Achernar' },
  { code: 'de', name: 'German', flag: '🇩🇪', ttsLocale: 'de-DE', ttsVoice: 'de-DE-Chirp3-HD-Achernar' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺', ttsLocale: 'ru-RU', ttsVoice: 'ru-RU-Chirp3-HD-Achernar' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳', ttsLocale: 'cmn-CN', ttsVoice: 'cmn-CN-Chirp3-HD-Achernar' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵', ttsLocale: 'ja-JP', ttsVoice: 'ja-JP-Chirp3-HD-Achernar' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷', ttsLocale: 'ko-KR', ttsVoice: 'ko-KR-Chirp3-HD-Achernar' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩', ttsLocale: 'id-ID', ttsVoice: 'id-ID-Chirp3-HD-Achernar' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷', ttsLocale: 'tr-TR', ttsVoice: 'tr-TR-Chirp3-HD-Achernar' },
  { code: 'it', name: 'Italian', flag: '🇮🇹', ttsLocale: 'it-IT', ttsVoice: 'it-IT-Chirp3-HD-Achernar' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳', ttsLocale: 'ta-IN', ttsVoice: 'ta-IN-Chirp3-HD-Achernar' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳', ttsLocale: 'ml-IN', ttsVoice: 'ml-IN-Chirp3-HD-Achernar' },
];
```

- [ ] **Step 4: Expose `flag` in the language API**

In `server/src/api/routes/ai.routes.ts`, change the `/settings/language` GET (line 22) mapping to:

```ts
    res.json({ lang: ctx.langs.getGlobal(req.userId!), supported: SUPPORTED_LANGS.map((l) => ({ code: l.code, name: l.name, flag: l.flag })) }));
```

- [ ] **Step 5: Add `flag` to the web type**

In `web/src/lib/types.ts`, replace the `LangOption` interface with:

```ts
export interface LangOption {
  code: string;
  name: string;
  flag: string;
}
```

- [ ] **Step 6: Run backend tests**

Run: `cd "E:/New Whatsapp/server" && npm test`
Expected: PASS (all green; `langs` flag test passes, existing `supported.length` test unaffected).

- [ ] **Step 7: Commit**

```bash
cd "E:/New Whatsapp"
git add server/src/ai/langs.ts server/src/ai/langs.test.ts server/src/api/routes/ai.routes.ts web/src/lib/types.ts
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat: country flags per language + expose via language API" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Web — API client method + Message fields

**Files:**
- Modify: `web/src/lib/api.ts` (add `sendVoiceTranslated`)
- Modify: `web/src/lib/types.ts` (`Message.translating`, `Message.localAudio`)

- [ ] **Step 1: Add the Message fields**

In `web/src/lib/types.ts`, add to the `Message` interface (after `original?`):

```ts
  translating?: string; // when set, bubble shows the animated loader with this label
  localAudio?: string;  // data URI for own TTS voice playback (no /api/media round-trip)
```

- [ ] **Step 2: Add the API method**

In `web/src/lib/api.ts`, add inside the `api` object (after the `tts:` entry, ~line 75):

```ts
  sendVoiceTranslated: (acc: string, chatId: string, message: string, translateTo?: string) =>
    post<{ success: boolean; voiceMsgId: string | null; textMsgId: string | null; sentText: string; original?: string; audioBase64: string; mime: string }>(
      `/api/send-voice?account=${enc(acc)}`,
      { chatId, message, translateTo },
    ),
```

- [ ] **Step 3: Type-check via build**

Run: `cd "E:/New Whatsapp/web" && npm run build`
Expected: PASS (`tsc -b` clean, vite build succeeds).

- [ ] **Step 4: Commit**

```bash
cd "E:/New Whatsapp"
git add web/src/lib/api.ts web/src/lib/types.ts
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat(web): sendVoiceTranslated api + Message.translating/localAudio fields" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Web — TranslatingLoader + MessageBubble (loader + own-voice playback)

**Files:**
- Create: `web/src/components/chat/TranslatingLoader.tsx`
- Modify: `web/src/styles/index.css` (slow-spin keyframe)
- Modify: `web/src/components/chat/MessageBubble.tsx` (render loader; voice src uses `localAudio`)

- [ ] **Step 1: Create the loader component**

```tsx
// web/src/components/chat/TranslatingLoader.tsx
import { GlobeIcon } from '../ui/icons';

export function TranslatingLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-white/75 py-0.5">
      <GlobeIcon className="w-3.5 h-3.5 text-[#4fd1ab] spin-slow" />
      <span>{label}</span>
      <span className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1 h-1 rounded-full bg-[#4fd1ab] animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add the slow-spin keyframe**

Append to `web/src/styles/index.css`:

```css
@keyframes spin-slow { to { transform: rotate(360deg); } }
.spin-slow { animation: spin-slow 2.4s linear infinite; }
```

- [ ] **Step 3: Render the loader + own-voice playback in MessageBubble**

In `web/src/components/chat/MessageBubble.tsx`:

(a) Add the import at the top:

```tsx
import { TranslatingLoader } from './TranslatingLoader';
```

(b) At the very start of `renderContent(msg, accountId, lang)` (before the `image` check), add:

```tsx
  if (msg.translating) {
    return (
      <div>
        <TranslatingLoader label={msg.translating} />
        <Meta msg={msg} />
      </div>
    );
  }
```

(c) Change the `ptt`/`audio` branch so own messages play the locally-returned audio:

```tsx
  if (msg.type === 'ptt' || msg.type === 'audio') {
    return (
      <div>
        <VoicePlayer src={msg.localAudio ?? api.mediaUrl(accountId, msg.msgId)} />
        <Meta msg={msg} />
      </div>
    );
  }
```

- [ ] **Step 4: Type-check via build**

Run: `cd "E:/New Whatsapp/web" && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd "E:/New Whatsapp"
git add web/src/components/chat/TranslatingLoader.tsx web/src/styles/index.css web/src/components/chat/MessageBubble.tsx
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat(web): animated translating loader + own-voice local playback" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Web — Composer send-mode toggle + ChatView wiring

**Files:**
- Modify: `web/src/components/chat/Composer.tsx` (add `sendMode`/`onSendModeChange` props, toggle UI, flag, adaptive header/placeholder)
- Modify: `web/src/components/chat/ChatView.tsx` (`sendMode` state, `send()` text/voice branch, pass props to Composer)

- [ ] **Step 1: Update the Composer props + body**

Replace the whole `web/src/components/chat/Composer.tsx` with:

```tsx
import { useState } from 'react';
import type { LangOption } from '../../lib/types';
import { SendIcon, MicIcon, GlobeIcon } from '../ui/icons';

export function Composer({
  onSend,
  langs,
  outLang,
  onOutLangChange,
  sendMode,
  onSendModeChange,
}: {
  onSend: (text: string) => void;
  langs: LangOption[];
  outLang: string; // '' = send as typed; otherwise translate outgoing to this lang
  onOutLangChange: (code: string) => void;
  sendMode: 'text' | 'voice';
  onSendModeChange: (mode: 'text' | 'voice') => void;
}) {
  const [text, setText] = useState('');

  function submit() {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
  }

  const selLang = langs.find((l) => l.code === outLang);
  const outName = selLang?.name;
  const flag = selLang?.flag ?? '🌐';
  const voice = sendMode === 'voice' && !!outLang;

  return (
    <footer className="flex flex-col bg-panel border-t border-line">
      {outLang && (
        <div className="px-4 pt-2 text-[12px] text-[#4fd1ab] flex items-center gap-1.5">
          <GlobeIcon className="w-3.5 h-3.5" />
          {voice
            ? <>Your messages are sent as a <b className="font-semibold">{outName}</b> voice note (+ text).</>
            : <>Your messages are translated to <b className="font-semibold">{outName}</b> before sending.</>}
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex-1 flex items-center gap-2 bg-panel2 rounded-xl px-3 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={outLang ? (voice ? `Type — sent as ${outName} voice 🔊` : `Type in any language — sent in ${outName}`) : 'Type a message'}
            className="flex-1 bg-transparent border-none outline-none text-txt text-[14.5px]"
          />

          {/* send-mode: text / voice, each with the target flag */}
          <div className="flex items-center gap-0.5 bg-rowhover rounded-md p-0.5 flex-none">
            <button
              type="button"
              onClick={() => onSendModeChange('text')}
              title={`Send as text${outName ? ' in ' + outName : ''}`}
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${sendMode === 'text' ? 'bg-teal/20 text-teal' : 'text-muted'}`}
            >
              <span>{flag}</span><span>Aa</span>
            </button>
            <button
              type="button"
              disabled={!outLang}
              onClick={() => onSendModeChange('voice')}
              title={outLang ? `Send as voice in ${outName}` : 'Pick a language first'}
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${voice ? 'bg-teal/20 text-teal' : 'text-muted'} ${!outLang ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <span>{flag}</span><MicIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="relative flex-none">
            <select
              value={outLang}
              onChange={(e) => onOutLangChange(e.target.value)}
              title="Send in language"
              className={`appearance-none cursor-pointer text-[11px] font-semibold rounded-md pl-2 pr-5 py-1 border-none outline-none ${
                outLang ? 'text-teal bg-teal/15' : 'text-muted bg-rowhover'
              }`}
            >
              <option value="">Send as typed</option>
              {langs.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} → {l.name}
                </option>
              ))}
            </select>
            <GlobeIcon className={`w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none ${outLang ? 'text-teal' : 'text-muted'}`} />
          </div>
        </div>
        <button onClick={submit} className="w-[46px] h-[46px] rounded-full grid place-items-center text-[#06291f] flex-none" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }} title="Send">
          {voice ? <MicIcon className="w-6 h-6" /> : <SendIcon className="w-6 h-6" />}
        </button>
      </div>
    </footer>
  );
}
```

The Composer now requires `sendMode`/`onSendModeChange` props. Wire ChatView in this same task (next steps) so the build goes green once, then commit both files together. (Do not build/commit between the Composer and ChatView edits.)

**Also modify:** `web/src/components/chat/ChatView.tsx` (`sendMode` state, `send()` branch, pass props to Composer).

- [ ] **Step 2: Add sendMode state + persistence (ChatView)**

In `web/src/components/chat/ChatView.tsx`, after the `outLang` state (line 17) add:

```tsx
  const [sendMode, setSendMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
```

In the existing `useEffect` that resets `outLang` on `jid` change (lines 29-31), add a reset for the mode:

```tsx
  useEffect(() => {
    setOutLang(localStorage.getItem('bondhu_out_' + jid) || '');
    setSendMode((localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
  }, [jid]);
```

After `changeOutLang` (line 36) add:

```tsx
  function changeSendMode(mode: 'text' | 'voice') {
    setSendMode(mode);
    localStorage.setItem('bondhu_mode_' + jid, mode);
  }
```

- [ ] **Step 3: Replace `send()` with the text/voice branch**

Replace the existing `async function send(text: string) { ... }` (lines 78-95) with:

```tsx
  const outName = langs.find((l) => l.code === outLang)?.name ?? outLang;

  async function send(text: string) {
    const id = 'tmp' + Date.now();

    // Voice mode: translated voice note + translated text
    if (sendMode === 'voice' && outLang) {
      const tmp: Message = {
        msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
        body: '', timestamp: Date.now(), ack: 1, reactions: [],
        translating: `Translating + generating ${outName} voice 🔊`,
      };
      setMessages((prev) => [...prev, tmp]);
      try {
        const res = await api.sendVoiceTranslated(accountId, jid, text, outLang);
        const voiceMsg: Message = {
          msgId: res.voiceMsgId || id + 'v', chatJid: jid, senderJid: null, fromMe: true, type: 'ptt',
          body: '[voice]', timestamp: Date.now(), ack: 1, reactions: [],
          localAudio: 'data:' + res.mime + ';base64,' + res.audioBase64,
        };
        const textMsg: Message = {
          msgId: res.textMsgId || id + 't', chatJid: jid, senderJid: null, fromMe: true, type: 'text',
          body: res.sentText, timestamp: Date.now() + 1, ack: 1, reactions: [], original: res.original,
        };
        setMessages((prev) => prev.filter((m) => m.msgId !== id).concat(voiceMsg, textMsg));
        onChatBump();
      } catch {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, translating: undefined, body: text } : m)));
      }
      return;
    }

    // Text mode (translate-and-send, or send as typed)
    const tmp: Message = {
      msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
      body: outLang ? '' : text, timestamp: Date.now(), ack: 1, reactions: [],
      translating: outLang ? `Translating → ${outName}` : undefined,
      original: outLang ? text : undefined,
    };
    setMessages((prev) => [...prev, tmp]);
    try {
      const res = await api.send(accountId, jid, text, outLang || undefined);
      if (res.sentText) {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, body: res.sentText!, original: res.original, translating: undefined } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, translating: undefined } : m)));
      }
      onChatBump();
    } catch {
      setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, body: text, original: undefined, translating: undefined } : m)));
    }
  }
```

- [ ] **Step 4: Pass the new props to Composer**

Replace the `<Composer ... />` line (line 120) with:

```tsx
      <Composer onSend={send} langs={langs} outLang={outLang} onOutLangChange={changeOutLang} sendMode={sendMode} onSendModeChange={changeSendMode} />
```

- [ ] **Step 5: Build the web app**

Run: `cd "E:/New Whatsapp/web" && npm run build`
Expected: PASS — `tsc -b` clean, vite build succeeds.

- [ ] **Step 6: Commit Composer + ChatView together**

```bash
cd "E:/New Whatsapp"
git add web/src/components/chat/Composer.tsx web/src/components/chat/ChatView.tsx
git commit --author="nishatbd3388 <nishatbd3388@gmail.com>" \
  -m "feat(web): composer text/voice send-mode toggle + voice optimistic bubbles" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: End-to-end verification + finish the branch

**Files:** none (verification + integration).

- [ ] **Step 1: Rebuild web so the backend serves the new SPA**

Run: `cd "E:/New Whatsapp/web" && npm run build`
Expected: PASS. (Backend serves `web/dist`; tsx-watch server needs no restart for web changes.)

- [ ] **Step 2: Ensure the server is running with ffmpeg on PATH**

Run: `cd "E:/New Whatsapp/server" && npm run dev`
Expected: `[Bondhu] API + Socket.IO on http://localhost:3050`. (If ffmpeg was installed after the server started, stop and restart it so it inherits PATH.)

- [ ] **Step 3: Browser verification checklist** (open http://localhost:3050, log in as `nishatbd3388@gmail.com`, open a chat)

Confirm each:
- Language selector options show flags (e.g. `🇫🇷 → French`).
- The mode toggle shows `🇫🇷 Aa` and `🇫🇷 🎙️`; voice is disabled (greyed) until a language is selected.
- **Text mode** + French: typing shows the animated "Translating → French" loader, then the bubble becomes the French text. (Unchanged behavior, new loader.)
- **Voice mode** + French: the loader reads "Translating + generating French voice 🔊", then **two** own bubbles appear — a playable voice note (plays locally) and the French text. The recipient's WhatsApp receives a real voice note + the text.
- Switching chats remembers the per-chat mode and language.

- [ ] **Step 4: Full server test suite (regression)**

Run: `cd "E:/New Whatsapp/server" && npm test`
Expected: PASS — all tests green (49+).

- [ ] **Step 5: Finish the branch**

Use the superpowers:finishing-a-development-branch skill. Default: merge `feat/composer-send-mode` to `master` and push.

```bash
cd "E:/New Whatsapp"
git checkout master
git merge --no-ff feat/composer-send-mode -m "Merge: composer text/voice send-mode + translating loader"
git push origin master
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** UI toggle (Task 7), flags (Task 4 + 7), voice flow translate→TTS→opus→voice+text (Tasks 2,3,7), loader (Task 6), own-voice local playback (Tasks 3,6,7), error handling = existing 500→catch resets to typed text (Task 7). All covered.
- **ffmpeg dependency** is real and host-specific (Task 1). The transcode test skips cleanly where ffmpeg is absent; the route test mocks it so CI stays green.
- **No API key** behaves exactly as text mode does today: translation/TTS throw 500 → catch resets the bubble to the typed text.
- **Known limitation (per spec, out of scope):** the recipient gets two messages (voice then text); replaying *others'* voice still uses `/api/media` — only the sender's own TTS plays from `localAudio`.
