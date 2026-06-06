import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/api';
import { disconnectSocket } from '../../lib/socket';
import { avatarGradient, initials } from '../../lib/format';
import { useStore } from '../../store/useStore';
import { LogoIcon, PlusIcon, GearIcon, LogoutIcon } from '../ui/icons';

export function AccountRail() {
  const nav = useNavigate();
  const { accounts, activeAccount, setActiveAccount } = useStore();

  function logout() {
    auth.clear();
    disconnectSocket();
    localStorage.removeItem('bondhu_account');
    nav('/login', { replace: true });
  }

  return (
    <nav className="bg-panel border-r border-line flex flex-col items-center pt-3.5 pb-4 gap-1.5">
      <div className="w-[42px] h-[42px] rounded-[13px] grid place-items-center mb-2" style={{ background: 'linear-gradient(145deg,#25D366,#00A884 60%,#017561)', boxShadow: '0 4px 14px rgba(0,168,132,.35)' }}>
        <LogoIcon className="w-6 h-6" />
      </div>
      <div className="w-[34px] h-px bg-line my-1.5" />

      <div className="flex flex-col items-center gap-3.5 py-1">
        {accounts.map((a) => {
          const on = a.status === 'connected';
          const nm = a.label || (a.phone ? '+' + a.phone : 'Account');
          const active = a.id === activeAccount;
          return (
            <button
              key={a.id}
              title={`${nm} · ${a.status}`}
              onClick={() => {
                if (a.id !== activeAccount) {
                  setActiveAccount(a.id);
                  localStorage.removeItem('bondhu_chat');
                  nav('/');
                }
              }}
              className={`relative rounded-full ${active ? 'p-[3px]' : ''}`}
              style={active ? { boxShadow: '0 0 0 2px #00A884' } : undefined}
            >
              <div className="rounded-full grid place-items-center text-white font-semibold" style={{ width: active ? 40 : 42, height: active ? 40 : 42, background: avatarGradient(a.id), fontSize: 15 }}>
                {initials(nm)}
              </div>
              <span className="absolute -right-px -bottom-px w-[13px] h-[13px] rounded-full border-[2.5px] border-panel" style={{ background: on ? '#25D366' : '#667781' }} />
            </button>
          );
        })}
      </div>

      <button onClick={() => nav('/link')} title="Add account" className="w-[42px] h-[42px] rounded-full grid place-items-center text-muted hover:text-teal hover:border-teal transition" style={{ border: '1.6px dashed #3a4a54' }}>
        <PlusIcon className="w-5 h-5" />
      </button>

      <div className="flex-1" />
      <button onClick={() => nav('/settings')} className="icon-btn !rounded-xl" title="Settings"><GearIcon className="w-[22px] h-[22px]" /></button>
      <button onClick={logout} className="icon-btn !rounded-xl" title="Log out"><LogoutIcon className="w-[22px] h-[22px]" /></button>
    </nav>
  );
}
