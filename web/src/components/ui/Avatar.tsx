import { useEffect, useState } from 'react';
import { avatarGradient, initials } from '../../lib/format';

export function Avatar({ name, seed, size = 42, src }: { name: string; seed: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  // reset when the photo source changes (e.g. switching chats)
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="rounded-full object-cover flex-none bg-panel2"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold flex-none"
      style={{ width: size, height: size, background: avatarGradient(seed), fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export function Tick({ ack }: { ack: number }) {
  if (!ack || ack < 1) return null;
  const blue = ack >= 3;
  const dbl = ack >= 2;
  const cls = blue ? 'text-blue' : 'text-muted';
  const w = dbl ? 18 : 15;
  return (
    <svg className={cls} width={w} height="11" viewBox={dbl ? '0 0 18 11' : '0 0 15 11'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle' }}>
      {dbl ? <path d="M1 6 4 9 11.5 1.5M6.5 9 13 9.2 16.8 1.5" /> : <path d="M1.5 6 4.5 9 13 1.5" />}
    </svg>
  );
}
