import { useEffect } from 'react';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';

/** Loads the user's accounts + me, and ensures an active account is selected. */
export function useAccounts() {
  const { accounts, activeAccount, setAccounts, setActiveAccount, me, setMe } = useStore();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, accRes] = await Promise.all([api.me(), api.accounts()]);
        if (!alive) return;
        setMe(meRes);
        const list = accRes.accounts;
        setAccounts(list);
        if (!list.find((a) => a.id === activeAccount)) {
          const pick = list.find((a) => a.status === 'connected') || list[0];
          if (pick) setActiveAccount(pick.id);
        }
      } catch {
        /* 401 handled in api */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { accounts, activeAccount, me, setActiveAccount };
}
