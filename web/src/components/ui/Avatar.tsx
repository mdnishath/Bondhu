import { useEffect, useState } from 'react';
import { avatarGradient, initials } from '../../lib/format';

export function Avatar({ name, seed, size = 42, src }: { name: string; seed: string; size?: number; src?: string }) {
  const [loaded, setLoaded] = useState(false);
  // reset when the photo source changes (e.g. switching chats)
  useEffect(() => setLoaded(false), [src]);

  return (
    <div className="relative rounded-full overflow-hidden flex-none" style={{ width: size, height: size }}>
      {/* initials always render underneath, so the avatar is never blank/black
          while the photo loads or when there is no photo (404) */}
      <div
        className="absolute inset-0 grid place-items-center text-white font-semibold"
        style={{ background: avatarGradient(seed), fontSize: size * 0.36 }}
      >
        {initials(name)}
      </div>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
}

export function Tick({ ack }: { ack: number }) {
  if (!ack || ack < 1) return null;
  const blue = ack >= 3;
  const dbl = ack >= 2;
  const cls = blue ? 'text-blue' : 'text-muted';
  return (
    <svg
      className={cls}
      width={dbl ? 16 : 13}
      height="11"
      viewBox={dbl ? '0 0 16 11' : '0 0 13 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline', verticalAlign: 'middle' }}
    >
      {dbl ? (
        <path d="M1 6 L3.6 8.6 L9.8 2.4 M5.8 6 L8.4 8.6 L15 2.4" />
      ) : (
        <path d="M1.5 6 L4.5 9 L12 1.8" />
      )}
    </svg>
  );
}
