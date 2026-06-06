import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
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
  anchorRef,
  onPick,
  onClose,
}: {
  ownMessage: boolean;
  isTextLike: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onPick: (a: MessageAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');
  // Rendered in a portal with fixed positioning so the chat scroll container's
  // overflow can never clip it. Position is computed from the trigger button and
  // clamped to the viewport (flips above the message when there's no room below).
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const menu = ref.current;
    const anchor = anchorRef.current;
    if (!menu || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    const M = 8; // viewport margin
    // Right-align the menu to the trigger, then clamp horizontally.
    let left = a.right - m.width;
    left = Math.min(Math.max(left, M), window.innerWidth - m.width - M);
    // Below the trigger by default; flip above if it would overflow the bottom.
    let top = a.bottom + 4;
    if (top + m.height > window.innerHeight - M) {
      const above = a.top - m.height - 4;
      top = above >= M ? above : Math.max(M, window.innerHeight - m.height - M);
    }
    setPos({ top, left });
  }, [customOpen, anchorRef]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return; // let the trigger toggle itself
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Close if the chat scrolls — a fixed menu would otherwise detach from its bubble.
    const onScroll = () => onClose();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose, anchorRef]);

  function pick(a: MessageAction) { onPick(a); onClose(); }

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      className="z-[60] bg-panel2 border border-line rounded-xl shadow-xl text-[13.5px] min-w-[180px] overflow-hidden"
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
    </div>,
    document.body,
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
