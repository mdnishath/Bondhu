import { create } from 'zustand';
import type { Account, User } from '../lib/types';

interface AppState {
  me: User | null;
  accounts: Account[];
  activeAccount: string;
  setMe: (me: User | null) => void;
  setAccounts: (a: Account[]) => void;
  setActiveAccount: (id: string) => void;
}

const ACC_KEY = 'bondhu_account';

export const useStore = create<AppState>((set) => ({
  me: null,
  accounts: [],
  activeAccount: localStorage.getItem(ACC_KEY) || '',
  setMe: (me) => set({ me }),
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (id) => {
    localStorage.setItem(ACC_KEY, id);
    set({ activeAccount: id });
  },
}));
