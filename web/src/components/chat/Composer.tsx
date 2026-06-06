import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { LangOption, Message } from '../../lib/types';
import { SendIcon, MicIcon, GlobeIcon, ReplyIcon, CloseIcon, ClipIcon } from '../ui/icons';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function Composer({
  onSend,
  onMicSend,
  onSendImage,
  langs,
  outLang,
  onOutLangChange,
  sendMode,
  onSendModeChange,
  accountId,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string) => void;
  /** Mic-recorded transcript: parent auto-sends as AI voice + text (no original audio leaves the device). */
  onMicSend: (transcript: string) => void;
  onSendImage: (imageBase64: string, dataUri: string, caption: string) => void;
  langs: LangOption[];
  outLang: string; // '' = send as typed; otherwise translate outgoing to this lang
  onOutLangChange: (code: string) => void;
  sendMode: 'text' | 'voice';
  onSendModeChange: (mode: 'text' | 'voice') => void;
  accountId: string;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUri = String(reader.result);
      const base64 = dataUri.split(',')[1] || '';
      if (base64) onSendImage(base64, dataUri, text.trim());
      setText('');
    };
    reader.readAsDataURL(f);
  }

  function submit() {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        if (!blob.size) return;
        setTranscribing(true);
        try {
          const b64 = await blobToBase64(blob);
          const { transcript } = await api.transcribe(accountId, b64, mime);
          // Hand the transcript to the parent for an immediate AI-voice + text
          // send. The original recording is intentionally discarded so it can
          // never reach the recipient.
          if (transcript) onMicSend(transcript);
        } catch {
          alert('Transcription failed — check your API key.');
        }
        setTranscribing(false);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      alert('Microphone access is needed to record voice.');
    }
  }
  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }
  function toggleRec() {
    if (recording) stopRec(); else startRec();
  }

  const selLang = langs.find((l) => l.code === outLang);
  const outName = selLang?.name;
  const flag = selLang?.flag ?? '🌐';
  const voice = sendMode === 'voice' && !!outLang;
  const placeholder = recording
    ? '● Recording… tap the mic to stop'
    : transcribing
      ? 'Transcribing…'
      : outLang
        ? (voice ? `Type / record — sent as ${outName} voice 🔊` : `Type / record — sent in ${outName}`)
        : 'Type a message';

  return (
    <footer className="flex flex-col bg-panel border-t border-line">
      {replyTo && (
        <div className="mx-4 mt-2 flex items-stretch gap-2 bg-panel2 border-l-[3px] border-teal rounded-md px-3 py-1.5">
          <div className="flex-1 min-w-0">
            <div className="text-[11.5px] text-teal flex items-center gap-1"><ReplyIcon className="w-3 h-3" />Replying to {replyTo.fromMe ? 'yourself' : 'message'}</div>
            <div className="text-[12.5px] text-txtsoft truncate">{replyTo.body || replyTo.transcript || `[${replyTo.type}]`}</div>
          </div>
          <button onClick={onCancelReply} className="icon-btn text-muted" title="Cancel reply"><CloseIcon className="w-4 h-4" /></button>
        </div>
      )}
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
            placeholder={placeholder}
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
              title={outLang ? `Send as voice in ${outName ?? outLang}` : 'Pick a language first'}
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

        {/* attach an image */}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <button onClick={() => fileRef.current?.click()} title="Attach image" className="icon-btn flex-none text-muted">
          <ClipIcon className="w-[22px] h-[22px]" />
        </button>

        {/* record voice -> transcribe into the box (then send via the chosen mode) */}
        <button
          onClick={toggleRec}
          disabled={transcribing}
          title={recording ? 'Stop recording' : 'Record voice'}
          className={`icon-btn flex-none ${recording ? 'text-[#ff5d5d] animate-pulse' : transcribing ? 'text-teal animate-pulse' : 'text-muted'}`}
        >
          <MicIcon className="w-[22px] h-[22px]" />
        </button>

        <button onClick={submit} className="w-[46px] h-[46px] rounded-full grid place-items-center text-[#06291f] flex-none" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }} title="Send">
          <SendIcon className="w-6 h-6" />
        </button>
      </div>
    </footer>
  );
}
