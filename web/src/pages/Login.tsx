import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../lib/api';
import { LogoIcon } from '../components/ui/icons';

export function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  if (auth.isAuthed()) {
    nav('/', { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!email || !pass) return setErr('Enter email and password');
    if (reg && pass.length < 6) return setErr('Password must be at least 6 characters');
    setBusy(true);
    try {
      const res = reg ? await api.register(email, pass, name) : await api.login(email, pass);
      auth.setToken(res.token);
      nav('/', { replace: true });
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <div className="h-full w-full grid md:grid-cols-[1.05fr_1fr] bg-bg">
      {/* brand panel */}
      <section
        className="relative overflow-hidden hidden md:flex flex-col justify-between p-14"
        style={{
          background:
            'radial-gradient(90% 70% at 20% 15%,rgba(37,211,102,.22),transparent 60%),radial-gradient(80% 80% at 95% 100%,rgba(0,168,132,.28),transparent 55%),linear-gradient(150deg,#0c2a26,#0B141A 60%)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[14px] grid place-items-center" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}>
            <LogoIcon className="w-6 h-6" />
          </div>
          <span className="text-[21px] font-bold tracking-tight">Bondhu</span>
        </div>
        <div className="max-w-[440px]">
          <h1 className="text-[42px] font-bold leading-[1.12] tracking-tight mb-4">
            Talk to anyone,
            <br />
            in <span className="text-[#4fd1ab]">any language</span>.
          </h1>
          <p className="text-[16px] text-txtsoft leading-relaxed">
            Real-time message translation, voice-note transcripts, and crisp end-to-end encrypted chats — beautifully simple.
          </p>
        </div>
        <div className="text-xs text-muted2">© 2026 Bondhu · Your messages stay yours.</div>
      </section>

      {/* form panel */}
      <section className="flex items-center justify-center p-10 bg-panel">
        <form className="w-full max-w-[380px]" onSubmit={submit}>
          <h2 className="text-[27px] font-bold tracking-tight mb-2">{reg ? 'Create your Bondhu account' : 'Sign in to Bondhu'}</h2>
          <p className="text-[14.5px] text-muted leading-snug mb-7">
            {reg ? 'Sign up with your email to get started.' : 'Welcome back. Log in to your Bondhu account.'}
          </p>

          {reg && (
            <Field label="Your name">
              <input className="bondhu-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maya Sengupta" />
            </Field>
          )}
          <Field label="Email">
            <input className="bondhu-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input className="bondhu-input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" />
          </Field>

          {err && <div className="text-[#ff6b6b] text-[13px] mt-3">{err}</div>}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full py-[15px] rounded-xl font-semibold text-[#06291f] disabled:opacity-60 transition"
            style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}
          >
            {busy ? 'Please wait…' : reg ? 'Create account' : 'Log in'}
          </button>

          <div className="mt-6 pt-6 border-t border-line text-center text-sm text-muted">
            {reg ? 'Already have an account?' : 'New to Bondhu?'}
            <br />
            <button type="button" className="mt-3 text-txt font-semibold" onClick={() => setMode(reg ? 'login' : 'register')}>
              {reg ? 'Log in instead' : 'Create an account'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-[18px] first:mt-0">
      <label className="block text-[12.5px] text-muted mb-2">{label}</label>
      {children}
    </div>
  );
}
