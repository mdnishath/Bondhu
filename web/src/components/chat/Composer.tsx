import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SendIcon, MicIcon } from '../ui/icons';

export function Composer({ onSend, lang }: { onSend: (text: string) => void; lang: string }) {
  const nav = useNavigate();
  const [text, setText] = useState('');

  function submit() {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText('');
  }

  return (
    <footer className="flex items-center gap-2 px-4 py-2.5 bg-panel border-t border-line">
      <div className="flex-1 flex items-center gap-2 bg-panel2 rounded-xl px-3 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Type a message"
          className="flex-1 bg-transparent border-none outline-none text-txt text-[14.5px]"
        />
        <button onClick={() => nav('/settings')} className="text-[11px] font-semibold text-teal bg-teal/15 rounded-md px-2 py-1 flex-none" title="Language settings">
          {lang.toUpperCase()}
        </button>
      </div>
      <button className="icon-btn" title="Voice message"><MicIcon className="w-[22px] h-[22px]" /></button>
      <button onClick={submit} className="w-[46px] h-[46px] rounded-full grid place-items-center text-[#06291f] flex-none" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }} title="Send">
        <SendIcon className="w-6 h-6" />
      </button>
    </footer>
  );
}
