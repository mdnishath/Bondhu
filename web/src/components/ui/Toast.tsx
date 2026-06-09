import { useEffect, useState } from 'react';

export type ToastKind = 'error' | 'info' | 'success';
interface ToastItem { id: number; text: string; kind: ToastKind }

let _id = 0;
const listeners = new Set<(t: ToastItem) => void>();

/** Fire a transient toast from anywhere (no provider/prop-drilling needed). */
export function toast(text: string, kind: ToastKind = 'error') {
  _id += 1;
  const t: ToastItem = { id: _id, text, kind };
  listeners.forEach((l) => l(t));
}

const STYLES: Record<ToastKind, string> = {
  error: 'bg-[#2a1416] border-[#ff6b6b]/40 text-[#ffb4b4]',
  info: 'bg-panel2 border-line text-txt',
  success: 'bg-[#16241a] border-[#A3E635]/40 text-[#cde8a0]',
};

/** Mount once at the app root. Stacks toasts bottom-center, auto-dismiss in 3.5s. */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3500);
    };
    listeners.add(on);
    return () => { listeners.delete(on); };
  }, []);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2 rounded-lg shadow-xl border text-[13.5px] max-w-[90vw] text-center ${STYLES[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
