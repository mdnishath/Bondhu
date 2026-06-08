import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Chat } from '../../lib/types';
import { displayName } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { CloseIcon, ForwardIcon } from '../ui/icons';

export function ForwardDialog({
  accountId,
  msgId,
  onClose,
  onDone,
}: {
  accountId: string;
  msgId: string;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.chats(accountId).then((r) => setChats(r.chats)).catch(() => {});
  }, [accountId]);

  function toggle(jid: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(jid) ? next.delete(jid) : next.add(jid);
      return next;
    });
  }

  async function go() {
    if (!picked.size) return;
    setBusy(true);
    try {
      const r = await api.forward(accountId, [msgId], Array.from(picked));
      onDone(r.forwarded);
    } catch {
      onDone(0);
    }
  }

  const filtered = query.trim()
    ? chats.filter((c) => displayName(c.jid, c.name).toLowerCase().includes(query.toLowerCase()))
    : chats;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 grid place-items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-panel border border-line rounded-2xl shadow-2xl w-[420px] max-w-[92vw] max-h-[78vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2 text-txt"><ForwardIcon className="w-5 h-5 text-teal" /><b>Forward to…</b></div>
          <button onClick={onClose} className="icon-btn"><CloseIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-2 border-b border-line">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" className="bondhu-input w-full" />
        </div>
        <div className="flex-1 overflow-y-auto scroll">
          {filtered.length === 0 ? (
            <div className="text-center text-muted py-8 text-sm">No chats</div>
          ) : (
            filtered.map((c) => {
              const nm = displayName(c.jid, c.name);
              const on = picked.has(c.jid);
              return (
                <button
                  key={c.jid}
                  onClick={() => toggle(c.jid)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-rowhover ${on ? 'bg-teal/10' : ''}`}
                >
                  <Avatar name={nm} seed={c.jid} size={36} src={api.profilePic(accountId, c.jid)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-txt text-[14.5px] truncate">{nm}</div>
                    <div className="text-muted text-[12px] truncate">{c.lastMessagePreview ?? ''}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 ${on ? 'bg-teal border-teal' : 'border-line'}`} />
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-line flex items-center justify-between">
          <span className="text-muted text-[12.5px]">{picked.size ? `${picked.size} selected` : 'Pick chats'}</span>
          <button
            onClick={go}
            disabled={!picked.size || busy}
            className="px-4 py-1.5 rounded-lg text-[#06291f] font-semibold disabled:opacity-40"
            style={{ background: 'linear-gradient(145deg,#38EC48,#A3E635)' }}
          >
            {busy ? 'Forwarding…' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
}
