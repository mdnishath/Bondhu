import { useState } from 'react';
import { api } from '../../lib/api';
import type { Message } from '../../lib/types';
import { clockTime } from '../../lib/format';
import { Tick } from '../ui/Avatar';
import { GlobeIcon, SpeakerIcon, PlayIcon } from '../ui/icons';
import { TranslatingLoader } from './TranslatingLoader';

export function MessageBubble({ msg, accountId, lang }: { msg: Message; accountId: string; lang: string }) {
  const out = msg.fromMe;
  const reacts = msg.reactions && msg.reactions.length > 0;

  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'} mb-1.5`}>
      <div className="relative max-w-[65%]">
        <div
          className="rounded-[10px] px-2.5 py-1.5 text-[14.2px] leading-snug shadow"
          style={{ background: out ? '#005C4B' : '#202C33' }}
        >
          {renderContent(msg, accountId, lang)}
        </div>
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

function Meta({ msg }: { msg: Message }) {
  return (
    <span className="float-right ml-2 mt-1 text-[11px] text-muted whitespace-nowrap select-none">
      {clockTime(msg.timestamp)} {msg.fromMe && <Tick ack={msg.ack} />}
    </span>
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
    return (
      <div className="-mx-1 -mt-0.5">
        <img src={api.mediaUrl(accountId, msg.msgId)} loading="lazy" className="rounded-lg max-w-full block" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        <div className="px-1 pt-1">
          {msg.body && msg.body !== '[image]' ? msg.body : ''}
          <Meta msg={msg} />
        </div>
      </div>
    );
  }
  if (msg.type === 'ptt' || msg.type === 'audio') {
    if (msg.fromMe && !msg.localAudio) {
      return (
        <div>
          <div className="flex items-center gap-2 text-[13px] text-white/75"><SpeakerIcon className="w-4 h-4" /> Voice message sent</div>
          <Meta msg={msg} />
        </div>
      );
    }
    return (
      <div>
        <VoicePlayer src={msg.localAudio ?? api.mediaUrl(accountId, msg.msgId)} />
        <Meta msg={msg} />
      </div>
    );
  }
  if (msg.translated && !msg.fromMe) {
    return (
      <div>
        <div className="text-txt">{msg.body}</div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#4fd1ab]">
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

function Speaker({ text, msgId, accountId, lang }: { text: string; msgId: string; accountId: string; lang: string }) {
  const [busy, setBusy] = useState(false);
  async function play() {
    setBusy(true);
    try {
      const r = await api.tts(accountId, msgId, text, lang);
      new Audio('data:' + r.mime + ';base64,' + r.audioBase64).play();
    } catch {
      /* ignore */
    }
    setTimeout(() => setBusy(false), 1200);
  }
  return (
    <button onClick={play} className={`text-muted hover:text-teal flex-none ${busy ? 'text-teal animate-pulse' : ''}`} title="Listen">
      <SpeakerIcon className="w-[18px] h-[18px]" />
    </button>
  );
}

function VoicePlayer({ src }: { src: string }) {
  const [audio] = useState(() => new Audio(src));
  const [playing, setPlaying] = useState(false);
  function toggle() {
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
    }
  }
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <button onClick={toggle} className="w-9 h-9 rounded-full grid place-items-center bg-teal/20 text-teal flex-none">
        {playing ? <span className="text-xs">❚❚</span> : <PlayIcon className="w-5 h-5" />}
      </button>
      <div className="flex-1 h-7 flex items-center gap-0.5">
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} className="bg-muted/60 rounded-full" style={{ width: 2, height: 6 + ((i * 7) % 18) }} />
        ))}
      </div>
    </div>
  );
}
