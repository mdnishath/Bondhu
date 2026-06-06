import { useCallback, useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../ui/icons';

const MIN_SCALE = 1;
const MAX_SCALE = 6;

/** Fullscreen image viewer with wheel-zoom (cursor as anchor), drag-to-pan,
 *  pinch-zoom for touch, and double-tap/click to toggle 2x. */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setScale((s) => clamp(s * 1.2));
      else if (e.key === '-' || e.key === '_') setScale((s) => clamp(s / 1.2));
      else if (e.key === '0') reset();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, reset]);

  // Reset transform when image source changes.
  useEffect(() => { reset(); }, [src, reset]);

  function clamp(s: number) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const next = clamp(scale * factor);
    const ratio = next / scale;
    setTx((tx - cx) * ratio + cx);
    setTy((ty - cy) * ratio + cy);
    setScale(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x));
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y));
  }
  function onPointerUp() { dragRef.current = null; }

  // Pinch (touch). We listen on the wrapper natively because React's synthetic
  // events don't expose touches list ergonomically here.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        pinchRef.current = {
          dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          scale,
          cx: (a.clientX + b.clientX) / 2,
          cy: (a.clientY + b.clientY) / 2,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const next = clamp(pinchRef.current.scale * (d / pinchRef.current.dist));
        setScale(next);
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [scale]);

  function onDoubleClick() {
    if (scale > 1.05) reset();
    else setScale(2);
  }

  function bumpZoom(factor: number) {
    setScale((s) => clamp(s * factor));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 grid place-items-center overflow-hidden" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white z-10"
        title="Close (Esc)"
      >
        <CloseIcon className="w-5 h-5" />
      </button>

      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[12.5px]"
        >
          Open in new tab
        </a>
      </div>

      {/* zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/10 backdrop-blur rounded-full px-2 py-1.5 z-10" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => bumpZoom(1 / 1.3)} className="w-8 h-8 rounded-full hover:bg-white/15 text-white text-lg leading-none">−</button>
        <button onClick={reset} className="px-3 h-8 rounded-full hover:bg-white/15 text-white text-[12.5px] tabular-nums min-w-[56px]">{Math.round(scale * 100)}%</button>
        <button onClick={() => bumpZoom(1.3)} className="w-8 h-8 rounded-full hover:bg-white/15 text-white text-lg leading-none">+</button>
      </div>

      <div
        ref={wrapRef}
        className="w-full h-full grid place-items-center select-none"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none', cursor: scale > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <img
          src={src}
          draggable={false}
          alt=""
          className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: dragRef.current || pinchRef.current ? 'none' : 'transform 80ms linear',
            transformOrigin: 'center center',
          }}
        />
      </div>
    </div>
  );
}
