import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Avatar } from '../ui/Avatar';

export function ProfilePanel({ accountId, jid, name, isGroup, onClose }: { accountId: string; jid: string; name: string; isGroup: boolean; onClose: () => void }) {
  const [about, setAbout] = useState<string | null>(null);
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setResolvedPhone(null);
    api.profile(accountId, jid)
      .then((r) => { if (alive) { setAbout(r.about); setResolvedPhone(r.phone); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accountId, jid]);

  // Phone-based jids (<digits>@s.whatsapp.net) carry the real number directly.
  // Privacy `<digits>@lid` jids do NOT — Baileys maps them back to the real
  // phone via signalRepository.lidMapping (returned in `resolvedPhone`).
  const domain = jid.split('@')[1] ?? '';
  const rawNumber = jid.split('@')[0];
  const isLid = domain === 'lid';
  const directPhone = !isGroup && !isLid && rawNumber && !rawNumber.startsWith('account') ? rawNumber : null;
  const phoneToShow = directPhone ?? resolvedPhone;

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex justify-end" onClick={onClose}>
      <div className="w-[360px] max-w-[90vw] h-full bg-panel border-l border-line overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <button onClick={onClose} className="icon-btn text-muted" title="Close">✕</button>
          <div className="text-[15px] font-semibold">Contact info</div>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 py-8">
          <Avatar name={name} seed={jid} size={130} src={api.profilePic(accountId, jid)} />
          <div className="text-[21px] font-semibold text-txt text-center break-words">{name}</div>
          {!isGroup && phoneToShow && <div className="text-[14px] text-muted">+{phoneToShow}</div>}
          {!isGroup && !phoneToShow && !loading && (
            <div className="text-[12.5px] text-muted italic">Phone not yet synced — message them once</div>
          )}
          {isGroup && <div className="text-[13px] text-muted">Group</div>}
        </div>

        <div className="px-6 pb-8">
          <div className="text-[12px] uppercase tracking-wider text-muted mb-1">About</div>
          <div className="text-[14.5px] text-txtsoft min-h-[20px]">{loading ? '…' : (about || '—')}</div>
        </div>
      </div>
    </div>
  );
}
