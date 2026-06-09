import { useEffect, useState } from 'react';

export interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PendingConfirm extends ConfirmOpts { id: number; resolve: (ok: boolean) => void }

let _id = 0;
const listeners = new Set<(c: PendingConfirm) => void>();

/** Promise-based replacement for window.confirm — resolves true/false. */
export function confirm(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    _id += 1;
    listeners.forEach((l) => l({ ...opts, id: _id, resolve }));
  });
}

/** Mount once at the app root. Shows one styled modal at a time. */
export function ConfirmHost() {
  const [current, setCurrent] = useState<PendingConfirm | null>(null);
  useEffect(() => {
    const on = (c: PendingConfirm) => setCurrent(c);
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);

  if (!current) return null;
  const close = (ok: boolean) => { current.resolve(ok); setCurrent(null); };

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-line bg-panel2 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold text-txt">{current.title}</div>
        {current.body && <div className="mt-2 text-[13.5px] text-muted leading-relaxed">{current.body}</div>}
        <div className="mt-5 flex justify-end gap-2 text-[14px]">
          <button
            onClick={() => close(false)}
            className="px-3.5 py-1.5 rounded-lg text-muted hover:bg-rowhover transition"
          >
            {current.cancelLabel ?? 'Cancel'}
          </button>
          <button
            onClick={() => close(true)}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition ${current.danger ? 'bg-[#ff6b6b]/15 text-[#ff8585] hover:bg-[#ff6b6b]/25' : 'bg-teal/20 text-teal hover:bg-teal/30'}`}
          >
            {current.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
