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
  const [showRail, setShowRail] = useState(false);

  const bump = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpd = () => bump();
    s.on('chat_update', onUpd);
    // Re-sync after a (re)connect — socket.io doesn't replay events missed while
    // disconnected (e.g. a server restart), so refetch the chat list on connect.
    s.on('connect', onUpd);
    return () => { s.off('chat_update', onUpd); s.off('connect', onUpd); };
  }, [activeAccount, bump]);

  function select(jid: string) {
    setSelectedJid(jid);
    localStorage.setItem('bondhu_chat', jid);
    nav(`/chat/${encodeURIComponent(jid)}`, { replace: true });
  }

  function goBack() {
    setSelectedJid('');
    localStorage.removeItem('bondhu_chat');
    nav('/', { replace: true });
  }

  const hasAccount = accounts.length > 0;
  const selectedChat = chats.find((c) => c.jid === selectedJid);
  const showChatList = !selectedJid;
  const showChatView = !!selectedJid;

  return (
    <div className="h-full w-full bg-bg flex overflow-hidden">
      {/* Account rail: full bar on desktop; mobile drawer toggled by hamburger */}
      <div className={`flex-none ${showRail ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden md:flex'}`}>
        <AccountRail onCloseDrawer={() => setShowRail(false)} />
      </div>
      {showRail && (
        <div onClick={() => setShowRail(false)} className="md:hidden fixed inset-0 z-30 bg-black/55" />
      )}

      {/* Chat list — full width on mobile, 360px on desktop */}
      <div
        className={`${showChatList ? 'flex' : 'hidden md:flex'} flex-col w-full md:w-[360px] md:flex-none min-w-0 h-full`}
      >
        <ChatListPanel
          chats={chats}
          activeJid={selectedJid}
          onSelect={select}
          reloadKey={reloadKey}
          onMenuClick={() => setShowRail(true)}
        />
      </div>

      {/* Chat view / empty states */}
      <div className={`${showChatView ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 h-full flex-col`}>
        {!hasAccount ? (
          <EmptyLink />
        ) : selectedJid ? (
          <ChatView accountId={activeAccount} jid={selectedJid} chat={selectedChat} onChatBump={bump} onBack={goBack} />
        ) : (
          <EmptySelect />
        )}
      </div>
    </div>
  );
}

function EmptySelect() {
  return (
    <main className="grid place-items-center chat-wall text-center w-full h-full">
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
    <main className="grid place-items-center chat-wall text-center w-full h-full">
      <div className="text-muted">
        <div className="text-[19px] mb-3 text-txtsoft">No WhatsApp account linked yet</div>
        <button onClick={() => nav('/link')} className="text-teal font-semibold text-[15px]">
          + Link an account
        </button>
      </div>
    </main>
  );
}
