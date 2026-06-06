import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../lib/api';
import type { ApiKeyView, LangOption } from '../lib/types';
import { useAccounts } from '../hooks/useAccounts';
import { AccountRail } from '../components/shell/AccountRail';
import { Avatar } from '../components/ui/Avatar';
import { disconnectSocket } from '../lib/socket';

export function SettingsPage() {
  const nav = useNavigate();
  const { me } = useAccounts();
  const [keys, setKeys] = useState<ApiKeyView[]>([]);
  const [newKey, setNewKey] = useState('');
  const [langs, setLangs] = useState<LangOption[]>([]);
  const [lang, setLang] = useState('bn');
  const [msg, setMsg] = useState('');

  async function loadKeys() {
    try {
      setKeys((await api.keys()).keys);
    } catch {
      /* */
    }
  }

  useEffect(() => {
    loadKeys();
    api
      .language()
      .then((r) => {
        setLangs(r.supported);
        setLang(r.lang);
      })
      .catch(() => {});
  }, []);

  async function addKey() {
    const v = newKey.trim();
    if (!v) return;
    try {
      await api.addKey(v, 'Google');
      setNewKey('');
      setMsg('API key added ✓');
      loadKeys();
    } catch (e: any) {
      setMsg(e.message);
    }
  }
  async function removeKey(id: string) {
    await api.removeKey(id);
    loadKeys();
  }
  async function activate(id: string) {
    await api.activateKey(id);
    loadKeys();
  }
  async function changeLang(code: string) {
    setLang(code);
    await api.setLanguage(code);
    setMsg('Default language updated ✓');
  }
  function logout() {
    auth.clear();
    disconnectSocket();
    localStorage.removeItem('bondhu_account');
    nav('/login', { replace: true });
  }

  return (
    <div className="h-full w-full grid bg-bg" style={{ gridTemplateColumns: '72px 1fr' }}>
      <AccountRail />
      <main className="overflow-y-auto scroll">
        <div className="max-w-[640px] mx-auto px-8 py-10">
          <h1 className="text-[26px] font-bold mb-8">Settings</h1>

          {/* profile */}
          <Section title="Profile">
            <div className="flex items-center gap-4">
              <Avatar name={me?.name || me?.email || 'Me'} seed={me?.id || 'me'} size={64} />
              <div>
                <div className="text-[18px] font-semibold">{me?.name || '—'}</div>
                <div className="text-[14px] text-muted">{me?.email}</div>
              </div>
            </div>
          </Section>

          {/* language */}
          <Section title="Translation language" hint="Incoming messages are auto-translated to this language.">
            <select value={lang} onChange={(e) => changeLang(e.target.value)} className="bondhu-input max-w-[280px]">
              {langs.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </Section>

          {/* API keys */}
          <Section title="Google API keys" hint="Needed for translation, text-to-speech, and voice transcription. Add a key with Generative Language (Gemini), Cloud Text-to-Speech, and Speech-to-Text enabled.">
            <div className="flex flex-col gap-2 mb-3">
              {keys.length === 0 && <div className="text-[13.5px] text-muted">No keys yet.</div>}
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 bg-panel2 rounded-[10px] px-3.5 py-2.5">
                  <span className="font-mono text-[13.5px] text-txtsoft flex-1">{k.keyMasked}</span>
                  {k.isActive ? (
                    <span className="text-[11px] font-semibold text-[#4fd1ab] bg-teal/15 rounded-md px-2 py-1">Active</span>
                  ) : (
                    <button onClick={() => activate(k.id)} className="text-[12px] text-muted hover:text-txt">Activate</button>
                  )}
                  <button onClick={() => removeKey(k.id)} className="text-[12px] text-[#ff6b6b]/80 hover:text-[#ff6b6b]">Delete</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="AIza…" className="bondhu-input flex-1 font-mono" />
              <button onClick={addKey} className="px-4 rounded-[10px] font-semibold text-[#06291f]" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}>Add key</button>
            </div>
          </Section>

          {msg && <div className="text-[13px] text-[#4fd1ab] mb-6">{msg}</div>}

          <button onClick={logout} className="text-[#ff6b6b] font-semibold text-[15px]">Log out</button>
        </div>
      </main>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-9">
      <div className="text-[15px] font-semibold mb-1">{title}</div>
      {hint && <div className="text-[13px] text-muted mb-3 leading-snug">{hint}</div>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}
