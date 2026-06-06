import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Chat, LangOption, Message } from '../../lib/types';
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
  const [langs, setLangs] = useState<LangOption[]>([]);
  const [outLang, setOutLang] = useState<string>(localStorage.getItem('bondhu_out_' + jid) || '');
  const [sendMode, setSendMode] = useState<'text' | 'voice'>(() => (localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const name = chat ? displayName(jid, chat.name) : displayName(jid);

  // load supported languages once for the outgoing-language selector
  useEffect(() => {
    api.language().then((r) => setLangs(r.supported)).catch(() => {});
  }, []);

  // remember the outgoing language and send mode per chat
  useEffect(() => {
    setOutLang(localStorage.getItem('bondhu_out_' + jid) || '');
    setSendMode((localStorage.getItem('bondhu_mode_' + jid) as 'text' | 'voice') || 'text');
  }, [jid]);
  function changeOutLang(code: string) {
    setOutLang(code);
    if (code) localStorage.setItem('bondhu_out_' + jid, code);
    else localStorage.removeItem('bondhu_out_' + jid);
  }
  function changeSendMode(mode: 'text' | 'voice') {
    setSendMode(mode);
    localStorage.setItem('bondhu_mode_' + jid, mode);
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

  const outName = langs.find((l) => l.code === outLang)?.name ?? outLang;

  async function send(text: string) {
    const id = 'tmp' + Date.now();

    // Voice mode: translated voice note + translated text
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
        setMessages((prev) => prev.filter((m) => m.msgId !== id).concat(voiceMsg, textMsg));
        onChatBump();
      } catch {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, translating: undefined, body: text } : m)));
      }
      return;
    }

    // Text mode (translate-and-send, or send as typed)
    const tmp: Message = {
      msgId: id, chatJid: jid, senderJid: null, fromMe: true, type: 'text',
      body: outLang ? '' : text, timestamp: Date.now(), ack: 1, reactions: [],
      translating: outLang ? `Translating → ${outName}` : undefined,
      original: outLang ? text : undefined,
    };
    setMessages((prev) => [...prev, tmp]);
    try {
      const res = await api.send(accountId, jid, text, outLang || undefined);
      if (res.sentText) {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, body: res.sentText!, original: res.original, translating: undefined } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, translating: undefined } : m)));
      }
      onChatBump();
    } catch {
      setMessages((prev) => prev.map((m) => (m.msgId === id ? { ...m, body: text, original: undefined, translating: undefined } : m)));
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

      <Composer onSend={send} langs={langs} outLang={outLang} onOutLangChange={changeOutLang} sendMode={sendMode} onSendModeChange={changeSendMode} />
    </main>
  );
}
