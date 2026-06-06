import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import { LogoIcon, BackIcon } from '../components/ui/icons';

export function LinkDevice() {
  const nav = useNavigate();
  const setActiveAccount = useStore((s) => s.setActiveAccount);
  const [status, setStatus] = useState('Starting…');
  const [pairCode, setPairCode] = useState('');
  const [phone, setPhone] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accRef = useRef<string>('');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.addAccount('');
        accRef.current = res.accountId;
        if (alive) {
          setStatus('Waiting for QR…');
          poll();
        }
      } catch (e: any) {
        setStatus(e.message);
      }
    })();
    return () => {
      alive = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function poll() {
    try {
      const s = await api.status(accRef.current);
      if (s.state === 'connected') {
        setActiveAccount(accRef.current);
        setStatus('Connected ✓ — opening Bondhu…');
        setTimeout(() => nav('/'), 800);
        return;
      }
      if (s.pairingCode) {
        setPairCode(s.pairingCode.replace(/(.{4})(.{4})/, '$1-$2'));
        setStatus('Enter the code below on your phone');
      } else if (s.qr && canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, s.qr, { width: 232, margin: 1, color: { dark: '#0B141A', light: '#ffffff' } });
        setStatus('Scan the QR with WhatsApp → Linked devices');
      }
    } catch (e: any) {
      setStatus(e.message);
    }
    pollRef.current = window.setTimeout(poll, 2500);
  }

  async function getCode() {
    const p = phone.replace(/[^0-9]/g, '');
    if (!p) return setStatus('Enter your phone number');
    try {
      await api.pair(accRef.current, p);
      setStatus('Generating pairing code…');
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <div className="h-full w-full grid place-items-center bg-bg relative">
      <button onClick={() => nav('/')} className="absolute top-7 left-9 icon-btn"><BackIcon className="w-5 h-5" /></button>
      <div className="absolute top-7 left-20 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}><LogoIcon className="w-6 h-6" /></div>
        <span className="text-lg font-bold">Bondhu</span>
      </div>

      <div className="w-[880px] max-w-[92vw] bg-panel border border-line rounded-[20px] shadow-2xl grid md:grid-cols-[1.15fr_1fr] overflow-hidden">
        <div className="p-12">
          <div className="text-[12.5px] font-bold tracking-wider uppercase text-teal mb-3">Bondhu Web</div>
          <h1 className="text-[30px] font-bold leading-tight mb-7">Link your WhatsApp account</h1>
          <ol className="flex flex-col gap-5 mb-7">
            {['Open WhatsApp on your phone', 'Tap Menu ⋮ then Linked devices', 'Tap Link a device and scan the QR — or use the phone-number code'].map((t, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-teal/15 text-[#4fd1ab] font-bold text-sm flex-none">{i + 1}</span>
                <span className="text-[15px] text-txtsoft leading-snug pt-1">{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 p-10 border-l border-line" style={{ background: 'linear-gradient(160deg,#0e2a26,#0c1c22)' }}>
          <div className="bg-white rounded-[18px] p-4 shadow-xl">
            <canvas ref={canvasRef} width={232} height={232} className="block" />
          </div>
          <div className="text-[13.5px] text-[#cfe9e2] text-center min-h-[20px]">{status}</div>

          <div className="w-full max-w-[260px] pt-4 mt-1 border-t border-white/10">
            <div className="text-[12.5px] text-[#cfe9e2] mb-2 text-center">Or link with your phone number</div>
            <div className="flex gap-2">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="8801XXXXXXXXX" className="bondhu-input flex-1" />
              <button onClick={getCode} className="px-3.5 rounded-[10px] font-semibold text-[#06291f]" style={{ background: 'linear-gradient(145deg,#25D366,#00A884)' }}>Get code</button>
            </div>
            {pairCode && (
              <div className="mt-3 text-center">
                <div className="text-[12px] text-muted mb-1">Enter this code in WhatsApp → Linked devices → Link with phone number</div>
                <div className="text-[26px] font-bold tracking-[3px] text-[#4fd1ab]">{pairCode}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
