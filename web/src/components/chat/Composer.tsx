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
        <button onClick={submit} className="w-[46px] h-[46px] rounded-full grid place-items-center text-[#06291f] flex-none" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }} title="Send">
          {voice ? <MicIcon className="w-6 h-6" /> : <SendIcon className="w-6 h-6" />}
        </button>
      </div>
    </footer>
  );
}
