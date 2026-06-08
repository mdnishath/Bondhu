const GRADS = [
  'linear-gradient(145deg,#A3E635,#017a63)',
  'linear-gradient(145deg,#7c5cff,#4b2fb0)',
  'linear-gradient(145deg,#f0883e,#b85c1f)',
  'linear-gradient(145deg,#ec4d8e,#a02360)',
  'linear-gradient(145deg,#3aa0ff,#1a5fb4)',
  'linear-gradient(145deg,#2bb3a3,#0c6e62)',
  'linear-gradient(145deg,#39c46e,#15803d)',
  'linear-gradient(145deg,#6c7cff,#3b3fb0)',
];

export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}

export function initials(name: string): string {
  const n = (name || '').replace(/[^\p{L}\p{N} ]/gu, '').trim();
  if (!n) return '#';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function displayName(jid: string, name?: string | null): string {
  if (name) return name;
  const [num, domain] = (jid || '').split('@');
  if (!num || num.startsWith('account')) return 'Unknown';
  // @lid digits are a privacy id, not a phone number — don't render as "+...".
  if (domain === 'lid') return 'WhatsApp user';
  return '+' + num;
}

export function fmtTime(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function clockTime(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
