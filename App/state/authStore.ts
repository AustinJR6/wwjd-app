import { create } from 'zustand';

interface AuthState {
  uid: string | null;
  idToken: string | null;
  authReady: boolean;
  setUid: (uid: string | null) => void;
  setIdToken: (token: string | null) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  idToken: null,
  authReady: false,
  setUid: (uid) => {
    console.log('🔐 setUid', { uid });
    set({ uid });
  },
  setIdToken: (idToken) => {
    console.log('🔐 setIdToken', { idToken });
    set({ idToken });
  },
  setAuthReady: (authReady) => {
    console.log('✅ authReady', authReady);
    set({ authReady });
  },
}));
