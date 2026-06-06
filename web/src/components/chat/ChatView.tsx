import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Chat, LangOption, Message, Reaction } from '../../lib/types';
import { displayName } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { GlobeIcon, SearchIcon, DotsIcon, BackIcon, CloseIcon } from '../ui/icons';
import { MessageBubble, type MessageBubbleHandlers } from './MessageBubble';
import { Composer } from './Composer';
import { ProfilePanel } from './ProfilePanel';
import { ForwardDialog } from './ForwardDialog';
import { getSocket } from '../../lib/socket';

export function ChatView({ accountId, jid, chat, onChatBump, onBack }: { accountId: string; jid: string; chat?: Chat; onChatBump: () => void; onBack?: () => void }) {
  const nav = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [lang, setLang] = useState('bn');
  const [langs, setLangs] = useState<LangOption[]>([]);
  const [outLang, setOutLang] = useState<string>(localStorage.getItem('bondhu_out_' + jid) || '');
  const [sendMode, setSendMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [chatLang, setChatLang] = useState('');
  const [msgReload, setMsgReload] = useState(0);
  const [presence, setPresence] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const name = chat ? displayName(jid, chat.name) : displayName(jid);

  useEffect(() => {
    api.language().then((r) => setLangs(r.supported)).catch(() => {});
  }, []);

  useEffect(() => {
    setOutLang(localStorage.getItem('bondhu_out_' + jid) || '');
    setSendMode((localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
    setReplyTo(null);
    api.chatLanguage(accountId, jid).then((r) => setChatLang(r.lang || '')).catch(() => {});
    setPresence('');
    api.presenceSubscribe(accountId, jid).catch(() => {});
  }, [accountId, jid]);

  function changeOutLang(code: string) {
    setOutLang(code);
    if (code) localStorage.setItem('bondhu_out_' + jid, code);
    else {
      localStorage.removeItem('bondhu_out_' + jid);
      changeSendMode('text');
    }
  }
  function changeSendMode(mode: 'text' | 'voice') {
    setSendMode(mode);
    localStorage.setItem('bondhu_mode_' + jid, mode);
  }

  function changeChatLang(code: string) {
    setChatLang(code);
    setShowMenu(false);
    api.setChatLanguage(accountId, jid, code || null).then(() => setMsgReload((n) => n + 1)).catch(() => {});
  }

  async function clearChat() {
    setShowMenu(false);
    if (!window.confirm('Clear all messages in this chat from this device?')) return;
    try { await api.clearChat(accountId, jid); setMessages([]); onChatBump(); } catch { alert('Clear failed'); }
  }

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
    return () => { alive = false; };
  }, [accountId, jid, msgReload]);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onMsg = (m: Message & { accountId: string }) => {
      if (m.accountId === accountId && m.chatJid === jid) {
        setMessages((prev) => {
          // If a message with this id exists (e.g. our optimistic bubble or an
          // earlier render of the same message), merge incoming fields over it
          // so a late-arriving transcript/translation doesn't get dropped.
          const idx = prev.findIndex((x) => x.msgId === m.msgId);
          if (idx >= 0) {
            const merged = { ...prev[idx], ...m };
            const next = prev.slice();
            next[idx] = merged;
            return next;
          }
          return [...prev, m];
        });
        api.markRead(accountId, jid).catch(() => {});
      }
      onChatBump();
    };
    const onReaction = (e: { accountId: string; msgId: string; emoji: string; sender: string }) => {
      if (e.accountId !== accountId) return;
      setMessages((prev) => prev.map((m) => {
        if (m.msgId !== e.msgId) return m;
        const others = (m.reactions ?? []).filter((r) => r.senderJid !== e.sender);
        const reactions: Reaction[] = e.emoji
          ? [...others, { msgId: e.msgId, senderJid: e.sender, emoji: e.emoji, fromMe: e.sender === 'me' }]
          : others;
        return { ...m, reactions };
      }));
    };
    const onAck = (e: { accountId: string; msgId: string; ack: number }) => {
      if (e.accountId !== accountId) return;
      setMessages((prev) => prev.map((m) => (m.msgId === e.msgId ? { ...m, ack: Math.max(m.ack, e.ack) } : m)));
    };
    const onDel = (e: { accountId: string; msgId: string }) => {
      if (e.accountId !== accountId) return;
      setMessages((prev) => prev.map((m) => (m.msgId === e.msgId ? { ...m, body: '[deleted]', type: 'deleted' } : m)));
    };
    const onEdit = (e: { accountId: string; msgId: string; text: string }) => {
      if (e.accountId !== accountId) return;
      setMessages((prev) => prev.map((m) => (m.msgId === e.msgId ? { ...m, body: e.text, edited: true } : m)));
    };
    const onPresence = (e: { accountId: string; jid: string; state: string }) => {
      if (e.accountId !== accountId || e.jid !== jid) return;
      const label = e.state === 'composing' ? 'typing…' : e.state === 'recording' ? 'recording…' : e.state === 'available' ? 'online' : '';
      setPresence(label);
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
      if (e.state === 'composing' || e.state === 'recording') {
        presenceTimer.current = setTimeout(() => setPresence('online'), 5000);
      }
    };
    s.on('message', onMsg);
    s.on('message_reaction', onReaction);
    s.on('message_ack', onAck);
    s.on('message_delete', onDel);
    s.on('message_edit', onEdit);
    s.on('presence', onPresence);
    return () => {
      s.off('message', onMsg);
      s.off('message_reaction', onReaction);
      s.off('message_ack', onAck);
      s.off('message_delete', onDel);
      s.off('message_edit', onEdit);
      s.off('presence', onPresence);
    };
  }, [accountId, jid, onChatBump]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const outName = langs.find((l) => l.code === outLang)?.name ?? outLang;

  /** Mic recording path: always send as AI voice + text (translate if outLang
   *  set, else TTS in user's lang). The user's raw recording is never sent. */
  async function micSend(transcript: string) {
    const id = 'tmp' + Date.now();
    const targetLang = outLang || lang;
    const willTranslate = !!outLang;
    const tmp: Message = {
      msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
      body: '', timestamp: Date.now(), ack: 1, reactions: [],
      translating: willTranslate ? `Translating + generating ${outName || targetLang} voice 🔊` : `Generating voice 🔊`,
    };
    setMessages((prev) => [...prev, tmp]);
    try {
      const res = await api.sendVoiceTranslated(accountId, jid, transcript, willTranslate ? targetLang : undefined);
      const voiceMsg: Message = {
        msgId: res.voiceMsgId || id + 'v', chatJid: jid, senderJid: null, fromMe: true, type: 'ptt',
        body: '[voice]', timestamp: Date.now(), ack: 1, reactions: [],
        localAudio: 'data:' + res.mime + ';base64,' + res.audioBase64,
        transcript: res.sentText, original: res.original,
      };
      const textMsg: Message = {
        msgId: res.textMsgId || id + 't', chatJid: jid, senderJid: null, fromMe: true, type: 'text',
        body: res.sentText, timestamp: Date.now() + 1, ack: 1, reactions: [], original: res.original,
      };
      setMessages((prev) =>
        prev.filter((m) => m.msgId !== id && m.msgId !== voiceMsg.msgId && m.msgId !== textMsg.msgId).concat(voiceMsg, textMsg),
      );
      onChatBump();
    } catch {
      setMessages((prev) => prev.filter((m) => m.msgId !== id));
      alert('Voice send failed.');
    }
  }

  async function send(text: string) {
    // Reply path: bypass outgoing-translation/voice modes for now; reply is
    // sent as plain text against the quoted message.
    if (replyTo) {
      const id = 'tmp' + Date.now();
      const tmp: Message = {
        msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
        body: text, timestamp: Date.now(), ack: 1, reactions: [],
      };
      setMessages((prev) => [...prev, tmp]);
      const quotedId = replyTo.msgId;
      setReplyTo(null);
      try {
        const res = await api.reply(accountId, jid, quotedId, text);
        setMessages((prev) => {
          const rest = prev.filter((m) => m.msgId !== id);
          const realId = res.msgId || id;
          if (rest.some((m) => m.msgId === realId)) return rest;
          return [...rest, { ...tmp, msgId: realId }];
        });
        onChatBump();
      } catch {
        setMessages((prev) => prev.filter((m) => m.msgId !== id));
        alert('Reply failed');
      }
      return;
    }

    const id = 'tmp' + Date.now();

    if (sendMode === 'voice' && outLang) {
      const tmp: Message = {
        msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
        body: '', timestamp: Date.now(), ack: 1, reactions: [],
        translating: `Translating + generating ${outName} voice 🔊`,
      };
      setMessages((prev) => [...prev, tmp]);
      try {
        const res = await api.sendVoiceTranslated(accountId, jid, text, outLang);
        const voiceMsg: Message = {
          msgId: res.voiceMsgId || id + 'v', chatJid: jid, senderJid: null, fromMe: true, type: 'ptt',
          body: '[voice]', timestamp: Date.now(), ack: 1, reactions: [],
          localAudio: 'data:' + res.mime + ';base64,' + res.audioBase64,
        };
        const textMsg: Message = {
          msgId: res.textMsgId || id + 't', chatJid: jid, senderJid: null, fromMe: true, type: 'text',
          body: res.sentText, timestamp: Date.now() + 1, ack: 1, reactions: [], original: res.original,
        };
        setMessages((prev) =>
          prev.filter((m) => m.msgId !== id && m.msgId !== voiceMsg.msgId && m.msgId !== textMsg.msgId).concat(voiceMsg, textMsg),
        );
        onChatBump();
      } catch {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, translating: undefined, body: text } : m)));
      }
      return;
    }

    const tmp: Message = {
      msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
      body: outLang ? '' : text, timestamp: Date.now(), ack: 1, reactions: [],
      translating: outLang ? `Translating → ${outName}` : undefined,
      original: outLang ? text : undefined,
    };
    setMessages((prev) => [...prev, tmp]);
    try {
      const res = await api.send(accountId, jid, text, outLang || undefined);
      setMessages((prev) => {
        const rest = prev.filter((m) => m.msgId !== id);
        const realId = res.msgId || id;
        if (rest.some((m) => m.msgId === realId)) return rest;
        return [...rest, { ...tmp, msgId: realId, body: res.sentText ?? text, original: res.original, translating: undefined }];
      });
      onChatBump();
    } catch {
      setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, body: text, original: undefined, translating: undefined } : m)));
    }
  }

  async function sendImage(imageBase64: string, dataUri: string, caption: string) {
    const id = 'tmp' + Date.now();
    const tmp: Message = {
      msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'image',
      body: caption || '[image]', timestamp: Date.now(), ack: 1, reactions: [],
      localImage: dataUri,
    };
    setMessages((prev) => [...prev, tmp]);
    try {
      const res = await api.sendImage(accountId, jid, imageBase64, caption || undefined);
      setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, msgId: res.msgId || id } : m)));
      onChatBump();
    } catch {
      setMessages((prev) => prev.filter((m) => m.msgId !== id));
      alert('Image send failed.');
    }
  }

  const bubbleHandlers: MessageBubbleHandlers = {
    onReply: (m) => { setReplyTo(m); },
    onForward: (m) => { setForwardMsg(m); },
    onReact: async (m, emoji) => {
      // Optimistic: patch local state, then call api
      setMessages((prev) => prev.map((x) => {
        if (x.msgId !== m.msgId) return x;
        const others = (x.reactions ?? []).filter((r) => !r.fromMe);
        const reactions: Reaction[] = emoji ? [...others, { msgId: m.msgId, senderJid: 'me', emoji, fromMe: true }] : others;
        return { ...x, reactions };
      }));
      try { await api.react(accountId, m.msgId, emoji); } catch { /* keep optimistic */ }
    },
    onEdit: async (m, newText) => {
      setMessages((prev) => prev.map((x) => (x.msgId === m.msgId ? { ...x, body: newText, edited: true } : x)));
      try { await api.editMessage(accountId, m.msgId, newText); }
      catch { alert('Edit failed'); }
    },
    onDelete: async (m) => {
      setMessages((prev) => prev.map((x) => (x.msgId === m.msgId ? { ...x, body: '[deleted]', type: 'deleted' } : x)));
      try {
        // Own messages: delete-for-everyone via WhatsApp. Incoming: delete only
        // from Bondhu's local DB (WhatsApp can't remove others' messages).
        if (m.fromMe) await api.deleteMessage(accountId, m.msgId);
        else await api.deleteLocal(accountId, m.msgId);
      } catch { alert('Delete failed'); }
    },
  };

  const sq = searchQuery.trim().toLowerCase();
  const shownMessages = sq
    ? messages.filter((m) => [m.body, m.translated, m.transcript, m.quotedBody].some((t) => !!t && t.toLowerCase().includes(sq)))
    : messages;

  return (
    <main className="flex flex-col min-h-0 chat-wall w-full h-full">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-panel border-b border-line flex-none">
        {onBack && (
          <button onClick={onBack} className="icon-btn md:hidden flex-none" title="Back">
            <BackIcon className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left" title="View contact info">
          <Avatar name={name} seed={jid} size={40} src={api.profilePic(accountId, jid)} />
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-medium text-txt truncate">{name}</div>
            <div className={`text-[12.5px] ${presence === 'typing…' || presence === 'recording…' ? 'text-teal' : 'text-muted'}`}>{presence || (chat?.isGroup ? 'group' : '')}</div>
          </div>
        </button>
        <button onClick={() => setShowSearch((s) => !s)} className={`icon-btn flex-none ${showSearch ? 'text-teal' : ''}`} title="Search in chat"><SearchIcon className="w-[21px] h-[21px]" /></button>
        <button className="icon-btn flex-none" title="Translation settings" onClick={() => nav('/settings')}><GlobeIcon className="w-[21px] h-[21px]" /></button>
        <div className="relative flex-none">
          <button onClick={() => setShowMenu((m) => !m)} className="icon-btn" title="Menu"><DotsIcon className="w-[21px] h-[21px]" /></button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-60 bg-panel2 border border-line rounded-lg shadow-xl py-1 text-[14px]">
                <div className="px-3 py-2 border-b border-line">
                  <div className="text-[11px] text-muted mb-1">Translate incoming to</div>
                  <select value={chatLang} onClick={(e) => e.stopPropagation()} onChange={(e) => changeChatLang(e.target.value)} className="w-full bg-panel text-txt text-[13px] rounded px-1.5 py-1 outline-none border border-line">
                    <option value="">Default</option>
                    {langs.map((l) => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                  </select>
                </div>
                <button onClick={() => { setShowMenu(false); setShowProfile(true); }} className="block w-full text-left px-3 py-2 hover:bg-rowhover">Contact info</button>
                <button onClick={() => { setShowMenu(false); setShowSearch(true); }} className="block w-full text-left px-3 py-2 hover:bg-rowhover">Search in chat</button>
                <button onClick={clearChat} className="block w-full text-left px-3 py-2 hover:bg-rowhover text-[#ff6b6b]">Clear chat</button>
              </div>
            </>
          )}
        </div>
      </header>

      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-panel border-b border-line flex-none">
          <SearchIcon className="w-4 h-4 text-muted flex-none" />
          <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in this chat…" className="flex-1 bg-transparent outline-none text-txt text-[14px]" />
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="icon-btn text-muted" title="Close search"><CloseIcon className="w-4 h-4" /></button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden scroll px-3 sm:px-[6%] py-4 min-w-0">
        {loading ? (
          <div className="text-center text-muted py-10">Loading…</div>
        ) : shownMessages.length === 0 ? (
          <div className="text-center text-muted py-10">{sq ? 'No matching messages' : 'No messages yet. Say hello 👋'}</div>
        ) : (
          shownMessages.map((m) => (
            <MessageBubble key={m.msgId} msg={m} accountId={accountId} lang={lang} handlers={bubbleHandlers} />
          ))
        )}
      </div>

      <Composer
        onSend={send}
        onMicSend={micSend}
        onSendImage={sendImage}
        langs={langs}
        outLang={outLang}
        onOutLangChange={changeOutLang}
        sendMode={sendMode}
        onSendModeChange={changeSendMode}
        accountId={accountId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {showProfile && (
        <ProfilePanel accountId={accountId} jid={jid} name={name} isGroup={!!chat?.isGroup} onClose={() => setShowProfile(false)} />
      )}

      {forwardMsg && (
        <ForwardDialog
          accountId={accountId}
          msgId={forwardMsg.msgId}
          onClose={() => setForwardMsg(null)}
          onDone={(n) => { setForwardMsg(null); if (n) onChatBump(); }}
        />
      )}
    </main>
  );
}
