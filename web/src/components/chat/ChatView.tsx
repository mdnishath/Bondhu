import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Chat, Message } from '../../lib/types';
import { displayName } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { GlobeIcon, SearchIcon, DotsIcon } from '../ui/icons';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { getSocket } from '../../lib/socket';

export function ChatView({ accountId, jid, chat, onChatBump }: { accountId: string; jid: string; chat?: Chat; onChatBump: () => void }) {
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [lang, setLang] = useState('bn');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const name = chat ? displayName(jid, chat.name) : displayName(jid);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .messages(accountId, jid)
      .then((r) => {
        if (!alive) return;
        setLang(r.lang || 'bn');
        setMessages(r.messages.slice().reverse());
        setLoading(false);
        api.markRead(accountId, jid).catch(() => {});
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [accountId, jid]);

  // realtime: append incoming for this chat
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onMsg = (m: Message & { accountId: string }) => {
      if (m.accountId === accountId && m.chatJid === jid) {
        setMessages((prev) => [...prev, m]);
        api.markRead(accountId, jid).catch(() => {});
      }
      onChatBump();
    };
    s.on('message', onMsg);
    return () => {
      s.off('message', onMsg);
    };
  }, [accountId, jid, onChatBump]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const tmp: Message = { msgId: 'tmp' + Date.now(), chatJid: jid, senderJid: null, fromMe: true, type: 'text', body: text, timestamp: Date.now(), ack: 1, reactions: [] };
    setMessages((prev) => [...prev, tmp]);
    try {
      await api.send(accountId, jid, text);
      onChatBump();
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="flex flex-col min-h-0 chat-wall">
      <header className="flex items-center gap-3 px-4 py-2.5 bg-panel border-b border-line flex-none">
        <Avatar name={name} seed={jid} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-medium text-txt truncate">{name}</div>
          <div className="text-[12.5px] text-muted">{chat?.isGroup ? 'group' : ''}</div>
        </div>
        <button className="icon-btn"><SearchIcon className="w-[21px] h-[21px]" /></button>
        <button className="icon-btn" title="Translation settings" onClick={() => nav('/settings')}><GlobeIcon className="w-[21px] h-[21px]" /></button>
        <button className="icon-btn"><DotsIcon className="w-[21px] h-[21px]" /></button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll px-[6%] py-4">
        {loading ? (
          <div className="text-center text-muted py-10">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted py-10">No messages yet. Say hello 👋</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.msgId} msg={m} accountId={accountId} lang={lang} />)
        )}
      </div>

      <Composer onSend={send} lang={lang} />
    </main>
  );
}
