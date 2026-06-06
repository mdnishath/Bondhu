import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ReplyIcon, ForwardIcon, TrashIcon, CopyIcon, PencilIcon, SmileIcon } from '../ui/icons';

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export type MessageAction =
  | { kind: 'reply' }
  | { kind: 'forward' }
  | { kind: 'react'; emoji: string }
  | { kind: 'copy' }
  | { kind: 'edit' }
  | { kind: 'delete' };

export function MessageActions({
  ownMessage,
  isTextLike,
  onPick,
  onClose,
}: {
  ownMessage: boolean;
  isTextLike: boolean;
  onPick: (a: MessageAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');
  // Flip the menu upward when there isn't enough room below (last messages would
  // otherwise open down into / behind the composer and be unclickable).
  const [dropUp, setDropUp] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // ~72px reserves the composer; if the menu's bottom runs past it, drop up.
    setDropUp(r.bottom > window.innerHeight - 72 && r.top - r.height > 8);
  }, [customOpen]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function pick(a: MessageAction) { onPick(a); onClose(); }

  return (
    <div
      ref={ref}
      className={`absolute z-30 right-0 bg-panel2 border border-line rounded-xl shadow-xl text-[13.5px] min-w-[180px] overflow-hidden ${
        dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
    >
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-line">
        {QUICK_EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => pick({ kind: 'react', emoji: e })}
            className="w-7 h-7 rounded-full grid place-items-center hover:bg-rowhover text-[16px]"
            title={`React ${e}`}
          >
            {e}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className="w-7 h-7 rounded-full grid place-items-center hover:bg-rowhover text-muted"
          title="More"
        >
          <SmileIcon className="w-4 h-4" />
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-line">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 2))}
            placeholder="😀"
            className="bondhu-input flex-1 text-[14px] !py-1"
          />
          <button
            disabled={!custom.trim()}
            onClick={() => pick({ kind: 'react', emoji: custom.trim() })}
            className="px-2 py-1 rounded-md bg-teal/20 text-teal text-[12px] disabled:opacity-40"
          >
            React
          </button>
        </div>
      )}

      <Row icon={<ReplyIcon className="w-4 h-4" />} label="Reply" onClick={() => pick({ kind: 'reply' })} />
      <Row icon={<ForwardIcon className="w-4 h-4" />} label="Forward" onClick={() => pick({ kind: 'forward' })} />
      <Row icon={<CopyIcon className="w-4 h-4" />} label="Copy" onClick={() => pick({ kind: 'copy' })} />
      {ownMessage && isTextLike && (
        <Row icon={<PencilIcon className="w-4 h-4" />} label="Edit" onClick={() => pick({ kind: 'edit' })} />
      )}
      <Row
        icon={<TrashIcon className="w-4 h-4" />}
        label={ownMessage ? 'Delete for everyone' : 'Delete for me'}
        danger
        onClick={() => pick({ kind: 'delete' })}
      />
    </div>
  );
}

function Row({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rowhover text-left ${danger ? 'text-[#ff7676]' : 'text-txt'}`}
    >
      <span className="text-muted">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
