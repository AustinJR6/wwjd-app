import { create } from 'zustand';

interface AuthState {
  uid: string | null;
  authReady: boolean;
  setUid: (uid: string | null) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  authReady: false,
  setUid: (uid) => {
    console.log('🔐 setUid', { uid });
    set({ uid });
  },
  setAuthReady: (authReady) => {
    console.log('✅ authReady', authReady);
    set({ authReady });
  },
}));
