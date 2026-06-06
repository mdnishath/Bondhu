import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useChats, ChatListPanel } from '../components/chatlist/ChatListPanel';
import { AccountRail } from '../components/shell/AccountRail';
import { ChatView } from '../components/chat/ChatView';
import { getSocket } from '../lib/socket';

export function ChatPage() {
  const nav = useNavigate();
  const { jid: jidParam } = useParams();
  const { accounts, activeAccount } = useAccounts();
  const [reloadKey, setReloadKey] = useState(0);
  const chats = useChats(activeAccount, reloadKey);

  const [selectedJid, setSelectedJid] = useState<string>(jidParam || localStorage.getItem('bondhu_chat') || '');

  const bump = useCallback(() => setReloadKey((k) => k + 1), []);

  // socket: refresh chat list on any update
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpd = () => bump();
    s.on('chat_update', onUpd);
    return () => {
      s.off('chat_update', onUpd);
    };
  }, [activeAccount, bump]);

  function select(jid: string) {
    setSelectedJid(jid);
    localStorage.setItem('bondhu_chat', jid);
    nav(`/chat/${encodeURIComponent(jid)}`, { replace: true });
  }

  const hasAccount = accounts.length > 0;
  const selectedChat = chats.find((c) => c.jid === selectedJid);

  return (
    <div className="h-full w-full grid bg-bg" style={{ gridTemplateColumns: '72px 360px 1fr' }}>
      <AccountRail />
      <ChatListPanel chats={chats} activeJid={selectedJid} onSelect={select} reloadKey={reloadKey} />
      {!hasAccount ? (
        <EmptyLink />
      ) : selectedJid ? (
        <ChatView accountId={activeAccount} jid={selectedJid} chat={selectedChat} onChatBump={bump} />
      ) : (
        <EmptySelect />
      )}
    </div>
  );
}

function EmptySelect() {
  return (
    <main className="grid place-items-center chat-wall text-center">
      <div className="text-muted">
        <div className="text-[19px] mb-2 text-txtsoft">Select a chat to start messaging</div>
        <div className="text-[13px]">Your conversations appear here.</div>
      </div>
    </main>
  );
}

function EmptyLink() {
  const nav = useNavigate();
  return (
    <main className="grid place-items-center chat-wall text-center">
      <div className="text-muted">
        <div className="text-[19px] mb-3 text-txtsoft">No WhatsApp account linked yet</div>
        <button onClick={() => nav('/link')} className="text-teal font-semibold text-[15px]">
          + Link an account
        </button>
      </div>
    </main>
  );
}
