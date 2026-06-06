import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Chat } from '../../lib/types';
import { displayName, fmtTime } from '../../lib/format';
import { Avatar, Tick } from '../ui/Avatar';
import { SearchIcon, PencilIcon } from '../ui/icons';
import { useStore } from '../../store/useStore';

export function ChatListPanel({
  chats,
  activeJid,
  onSelect,
  reloadKey,
}: {
  chats: Chat[];
  activeJid: string;
  onSelect: (jid: string) => void;
  reloadKey: number;
}) {
  const nav = useNavigate();
  const { me, accounts, activeAccount } = useStore();
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newNum, setNewNum] = useState('');
  void reloadKey;

  function startNew() {
    const digits = newNum.replace(/[^0-9]/g, '');
    if (!digits) return;
    setShowNew(false);
    setNewNum('');
    onSelect(digits + '@s.whatsapp.net');
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return chats;
    return chats.filter((c) => displayName(c.jid, c.name).toLowerCase().includes(s));
  }, [chats, q]);

  const acc = accounts.find((a) => a.id === activeAccount);

  return (
    <aside className="bg-panel border-r border-line flex flex-col min-h-0">
      <div className="px-3.5 pt-2.5 pb-1.5 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar name={me?.name || me?.email || 'Me'} seed={me?.id || 'me'} size={40} />
            <div>
              <div className="text-[15px] font-semibold text-txt">{me?.name || me?.email || 'You'}</div>
              <div className="text-xs text-muted">{acc?.phone ? '+' + acc.phone : 'not linked'}</div>
            </div>
          </div>
          <button className="icon-btn" title="New chat" onClick={() => setShowNew(true)}><PencilIcon className="w-[18px] h-[18px]" /></button>
        </div>
        <label className="flex items-center gap-2.5 bg-panel2 rounded-[10px] px-3 py-2 border border-transparent focus-within:border-teal/50">
          <SearchIcon className="w-[17px] h-[17px] text-muted flex-none" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or start new chat" className="flex-1 bg-transparent border-none outline-none text-txt text-[13.5px]" />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto scroll pt-0.5 pb-2">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted text-[13.5px]">
            {chats.length === 0 ? (
              <>
                No chats yet.
                <br />
                <br />
                <button onClick={() => nav('/link')} className="text-teal font-semibold">+ Link a WhatsApp account</button>
              </>
            ) : (
              'No matches'
            )}
          </div>
        ) : (
          filtered.map((c) => <ChatRow key={c.jid} chat={c} active={c.jid === activeJid} onClick={() => onSelect(c.jid)} accountId={activeAccount} />)
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/50 grid place-items-center" onClick={() => setShowNew(false)}>
          <div className="bg-panel border border-line rounded-xl p-5 w-[320px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-1">New chat</div>
            <div className="text-[12.5px] text-muted mb-3">Enter a phone number with country code (digits only).</div>
            <input
              autoFocus
              value={newNum}
              onChange={(e) => setNewNum(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startNew()}
              placeholder="8801XXXXXXXXX"
              className="w-full bg-panel2 rounded-lg px-3 py-2 text-txt text-[14px] outline-none border border-transparent focus:border-teal/50 mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="text-muted text-[13px] px-3 py-1.5">Cancel</button>
              <button onClick={startNew} className="text-[#06291f] font-semibold text-[13px] px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}>Start chat</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ChatRow({ chat, active, onClick }: { chat: Chat; active: boolean; onClick: () => void; accountId: string }) {
  const nm = displayName(chat.jid, chat.name);
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition ${active ? 'bg-rowactive' : 'hover:bg-rowhover'}`}>
      <Avatar name={nm} seed={chat.jid} size={48} />
      <div className="flex-1 min-w-0 border-b border-line/60 pb-2.5 -mb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[15.5px] text-txt truncate">{nm}</div>
          <div className="text-[12px] text-muted flex-none">{fmtTime(chat.lastMessageAt)}</div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="text-[13.5px] text-muted truncate">{chat.lastMessagePreview || ''}</div>
          {chat.unreadCount > 0 && <span className="flex-none text-[11px] font-semibold text-[#06291f] bg-green rounded-full min-w-[20px] h-[20px] px-1.5 grid place-items-center">{chat.unreadCount}</span>}
        </div>
      </div>
    </button>
  );
}

// keep ChatListPanel's data fetch hook colocated for reuse
export function useChats(accountId: string, reloadKey: number) {
  const [chats, setChats] = useState<Chat[]>([]);
  useEffect(() => {
    let alive = true;
    if (!accountId) {
      setChats([]);
      return;
    }
    api
      .chats(accountId)
      .then((r) => alive && setChats(r.chats))
      .catch(() => alive && setChats([]));
    return () => {
      alive = false;
    };
  }, [accountId, reloadKey]);
  return chats;
}
