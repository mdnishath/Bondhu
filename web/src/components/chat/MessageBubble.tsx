import { memo, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { Message } from '../../lib/types';
import { clockTime, senderColor } from '../../lib/format';
import { Tick } from '../ui/Avatar';
import { GlobeIcon, SpeakerIcon, PlayIcon, ChevronDownIcon } from '../ui/icons';
import { TranslatingLoader } from './TranslatingLoader';
import { MessageActions, type MessageAction } from './MessageActions';
import { Lightbox } from './Lightbox';
import { toast } from '../ui/Toast';
import { confirm } from '../ui/ConfirmDialog';

export interface MessageBubbleHandlers {
  onReply: (msg: Message) => void;
  onForward: (msg: Message) => void;
  onReact: (msg: Message, emoji: string) => void;
  onEdit: (msg: Message, newText: string) => void;
  onDelete: (msg: Message) => void;
  onJumpToQuoted: (msgId: string) => void;
}

function MessageBubbleInner({
  msg,
  accountId,
  lang,
  handlers,
  flash,
}: {
  msg: Message;
  accountId: string;
  lang: string;
  handlers: MessageBubbleHandlers;
  flash?: boolean;
}) {
  const out = msg.fromMe;
  const reacts = msg.reactions && msg.reactions.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.body ?? '');
  const deleted = msg.type === 'deleted' || msg.body === '[deleted]';
  const isTextLike = msg.type === 'text';

  useEffect(() => { setEditText(msg.body ?? ''); }, [msg.body]);

  async function handlePick(a: MessageAction) {
    if (a.kind === 'reply') handlers.onReply(msg);
    else if (a.kind === 'forward') handlers.onForward(msg);
    else if (a.kind === 'react') handlers.onReact(msg, a.emoji);
    else if (a.kind === 'copy') {
      const txt = msg.body || msg.transcript || '';
      if (txt) navigator.clipboard.writeText(txt).catch(() => {});
    } else if (a.kind === 'edit') { setEditing(true); setEditText(msg.body ?? ''); }
    else if (a.kind === 'delete') {
      // Own messages delete for everyone via WhatsApp; incoming only locally.
      const ok = await confirm({
        title: out ? 'Delete for everyone?' : 'Delete message?',
        body: out ? 'This message will be removed for everyone in the chat.' : 'This message will be removed on this device.',
        confirmLabel: 'Delete', danger: true,
      });
      if (ok) handlers.onDelete(msg);
    }
  }

  function saveEdit() {
    const t = editText.trim();
    if (!t || t === msg.body) { setEditing(false); return; }
    handlers.onEdit(msg, t);
    setEditing(false);
  }

  return (
    <div id={`msg-${msg.msgId}`} className={`group flex ${out ? 'justify-end' : 'justify-start'} mb-1.5 min-w-0`}>
      <div className="relative max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0">
        <div
          className={`rounded-[10px] px-2.5 py-1.5 text-[14.2px] leading-snug shadow transition-shadow ${flash ? 'ring-2 ring-[#A3E635]' : ''}`}
          style={{ background: out ? '#2A3A1E' : '#202C33' }}
        >
          {!out && msg.senderName && (
            <div className="text-[12px] font-semibold mb-0.5" style={{ color: senderColor(msg.senderJid ?? msg.senderName) }}>{msg.senderName}</div>
          )}
          {!deleted && !editing && msg.quotedMsgId && (msg.quotedBody || msg.quotedSenderJid) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlers.onJumpToQuoted(msg.quotedMsgId!); }}
              className="block w-full text-left mb-1 rounded-md bg-black/25 border-l-2 border-[#A3E635] px-2 py-1 hover:bg-black/35 transition"
              title="Go to quoted message"
            >
              <div className="text-[11.5px] text-[#A3E635] font-medium leading-tight mb-0.5">Reply</div>
              <div className="text-[12.5px] text-white/65 truncate">{msg.quotedBody || 'media message'}</div>
            </button>
          )}
          {editing ? (
            <EditEditor
              value={editText}
              onChange={setEditText}
              onSave={saveEdit}
              onCancel={() => setEditing(false)}
            />
          ) : deleted ? (
            <div className="italic text-white/60 text-[13px]">🚫 This message was deleted</div>
          ) : (
            renderContent(msg, accountId, lang)
          )}
        </div>

        {!editing && !deleted && (
          <button
            ref={btnRef}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={`absolute top-0.5 ${out ? 'right-0.5' : 'left-0.5'} w-5 h-5 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition`}
            style={{ background: out ? 'rgba(0,80,65,.85)' : 'rgba(20,30,36,.85)' }}
            title="Message actions"
          >
            <ChevronDownIcon className="w-3 h-3 text-white" />
          </button>
        )}

        {menuOpen && (
          <MessageActions
            ownMessage={out}
            isTextLike={isTextLike}
            anchorRef={btnRef}
            onPick={handlePick}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {reacts && (
          <div className="absolute -bottom-2 right-2 bg-panel2 rounded-full px-1.5 py-0.5 text-[11px] shadow flex gap-0.5 border border-line">
            {msg.reactions!.slice(0, 3).map((r, i) => (
              <span key={i}>{r.emoji}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Memoized: ChatView re-renders on every incoming message / ack / reaction; only
// bubbles whose own props changed need to re-render (handlers are useMemo'd).
export const MessageBubble = memo(MessageBubbleInner);

function Meta({ msg }: { msg: Message }) {
  return (
    <div className="flex items-center justify-end gap-1 mt-0.5 -mb-0.5 text-[11px] text-muted/80 leading-none whitespace-nowrap select-none">
      {msg.edited && <span className="italic text-muted/70">edited</span>}
      <span>{clockTime(msg.timestamp)}</span>
      {msg.fromMe && <Tick ack={msg.ack} />}
    </div>
  );
}

function renderContent(msg: Message, accountId: string, lang: string) {
  if (msg.translating) {
    return (
      <div>
        <TranslatingLoader label={msg.translating} />
        <Meta msg={msg} />
      </div>
    );
  }
  if (msg.type === 'image') {
    return <ImageBubble msg={msg} accountId={accountId} />;
  }
  if (msg.type === 'ptt' || msg.type === 'audio') {
    // Outgoing keeps the AI-voice player (the original recording was discarded
    // before send). Incoming plays the sender's actual voice AND surfaces the
    // transcript + your-language translation right below.
    return (
      <div>
        <VoicePlayer src={msg.localAudio ?? api.mediaUrl(accountId, msg.msgId)} />
        {msg.fromMe && msg.original && (
          <div className="text-[11px] text-white/45 mt-1 italic">you said: {msg.original}</div>
        )}
        {!msg.fromMe && (msg.transcript ? (
          <div className="mt-1.5 pt-1.5 border-t border-white/10">
            <div className="text-[11px] text-white/55 mb-0.5">Transcript</div>
            <div className="text-[13.5px] text-txt break-words">{msg.transcript}</div>
            {msg.translated && (
              <>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-[#A3E635]">
                  <GlobeIcon className="w-3 h-3" /> Translated
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="bn text-[14px] text-txtsoft flex-1 break-words">{msg.translated}</div>
                  <Speaker text={msg.translated} msgId={msg.msgId} accountId={accountId} lang={lang} />
                </div>
              </>
            )}
          </div>
        ) : (
          <IncomingVoiceRetry msg={msg} accountId={accountId} lang={lang} />
        ))}
        <Meta msg={msg} />
      </div>
    );
  }
  if (msg.translated && !msg.fromMe) {
    return (
      <div>
        <div className="text-txt">{msg.body}</div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#A3E635]">
          <GlobeIcon className="w-3 h-3" /> Translated
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="bn text-[14px] text-txtsoft flex-1">{msg.translated}</div>
          <Speaker text={msg.translated} msgId={msg.msgId} accountId={accountId} lang={lang} />
        </div>
        <Meta msg={msg} />
      </div>
    );
  }
  return (
    <div>
      <span className="text-txt break-words">{msg.body}</span>
      {msg.fromMe && msg.original && (
        <div className="text-[11px] text-white/45 mt-1 italic">you wrote: {msg.original}</div>
      )}
      <Meta msg={msg} />
    </div>
  );
}

function EditEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[200px]">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSave(); }
          if (e.key === 'Escape') onCancel();
        }}
        rows={Math.min(5, Math.max(1, value.split('\n').length))}
        className="bg-black/25 text-txt rounded-md px-2 py-1.5 outline-none border border-white/10 resize-none text-[14px]"
      />
      <div className="flex items-center justify-end gap-1.5 text-[12px]">
        <button onClick={onCancel} className="px-2 py-0.5 rounded text-white/70 hover:bg-white/10">Cancel</button>
        <button onClick={onSave} className="px-2.5 py-0.5 rounded bg-teal/30 text-teal">Save</button>
      </div>
    </div>
  );
}

function ImageBubble({ msg, accountId }: { msg: Message; accountId: string }) {
  const [open, setOpen] = useState(false);
  const src = msg.localImage ?? api.mediaUrl(accountId, msg.msgId);
  const caption = msg.body && msg.body !== '[image]' ? msg.body : '';

  return (
    <div className="-mx-1 -mt-0.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-lg overflow-hidden focus:outline-none"
        title="Tap to view"
      >
        <img
          src={src}
          loading="lazy"
          className="block w-full max-h-[260px] object-cover hover:opacity-95 transition"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          alt=""
        />
      </button>
      <div className="px-1 pt-1">
        {caption}
        <Meta msg={msg} />
      </div>
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </div>
  );
}

function IncomingVoiceRetry({ msg, accountId, lang }: { msg: Message; accountId: string; lang: string }) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const r = await api.retranscribe(accountId, msg.msgId);
      if (r.transcript) {
        setTranscript(r.transcript);
        try {
          const t = await api.retranslate(accountId, msg.msgId, r.transcript, msg.chatJid, lang);
          if (t.translated) setTranslated(t.translated);
        } catch { /* keep transcript only */ }
      }
    } catch {
      toast('Transcription failed — check your API key.');
    }
    setBusy(false);
  }

  if (transcript) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-white/10">
        <div className="text-[11px] text-white/55 mb-0.5">Transcript</div>
        <div className="text-[13.5px] text-txt break-words">{transcript}</div>
        {translated && (
          <>
            <div className="flex items-center gap-1 mt-1 text-[11px] text-[#A3E635]">
              <GlobeIcon className="w-3 h-3" /> Translated
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="bn text-[14px] text-txtsoft flex-1 break-words">{translated}</div>
              <Speaker text={translated} msgId={msg.msgId} accountId={accountId} lang={lang} />
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-[11.5px] text-white/45 italic">{busy ? 'Transcribing…' : 'No transcript'}</span>
      {!busy && (
        <button onClick={go} className="px-2 py-0.5 rounded-md bg-teal/20 text-teal text-[11px]">
          Transcribe
        </button>
      )}
    </div>
  );
}

function Speaker({ text, msgId, accountId, lang }: { text: string; msgId: string; accountId: string; lang: string }) {
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);
  async function play() {
    audioRef.current?.pause(); // stop any prior playback instead of overlapping
    setBusy(true);
    try {
      const r = await api.tts(accountId, msgId, text, lang);
      const a = new Audio('data:' + r.mime + ';base64,' + r.audioBase64);
      audioRef.current = a;
      a.addEventListener('ended', () => setBusy(false));
      a.addEventListener('error', () => setBusy(false));
      await a.play();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button onClick={play} className={`text-muted hover:text-teal flex-none ${busy ? 'text-teal animate-pulse' : ''}`} title="Listen">
      <SpeakerIcon className="w-[18px] h-[18px]" />
    </button>
  );
}

function fmtDur(s: number): string {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function VoicePlayer({ src }: { src: string }) {
  const [audio, setAudio] = useState(() => new Audio(src));
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const firstRun = useRef(true);

  // Rebuild the audio element when the source changes — e.g. an optimistic voice
  // bubble's data-URI is replaced by the real /media URL once the send resolves
  // (the old code captured the very first src forever and played stale audio).
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setAudio((prev) => { prev.pause(); return new Audio(src); });
    setPlaying(false); setCur(0); setDur(0);
  }, [src]);

  useEffect(() => {
    const onMeta = () => setDur(isFinite(audio.duration) ? audio.duration : 0);
    const onTime = () => setCur(audio.currentTime);
    const onEnd = () => { setPlaying(false); setCur(0); };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [audio]);

  function toggle() {
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().catch(() => {}); setPlaying(true); }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * dur;
    setCur(audio.currentTime);
  }

  const pct = dur ? Math.min(1, cur / dur) : 0;
  const label = playing || cur > 0 ? cur : dur;

  return (
    <div className="flex items-center gap-3 min-w-[210px]">
      <button onClick={toggle} className="w-9 h-9 rounded-full grid place-items-center bg-teal/20 text-teal flex-none">
        {playing ? <span className="text-xs">❚❚</span> : <PlayIcon className="w-5 h-5" />}
      </button>
      <div className="flex-1">
        <div className="h-7 flex items-center gap-0.5 cursor-pointer" onClick={seek}>
          {Array.from({ length: 26 }).map((_, i) => {
            const filled = i / 26 <= pct;
            return <span key={i} className="rounded-full flex-1 max-w-[3px]" style={{ height: 6 + ((i * 7) % 18), background: filled ? '#A3E635' : 'rgba(255,255,255,.28)' }} />;
          })}
        </div>
        <div className="text-[11px] text-muted mt-0.5 tabular-nums">{fmtDur(label)}</div>
      </div>
    </div>
  );
}
