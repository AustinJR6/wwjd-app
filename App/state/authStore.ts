import { create } from 'zustand'

interface AuthState {
  idToken: string | null
  refreshToken: string | null
  uid: string | null
  authReady: boolean
  setAuth: (data: { idToken: string; refreshToken: string; uid: string }) => void
  clearAuth: () => void
  setAuthReady: (ready: boolean) => void
  refreshIdToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set) => ({
  idToken: null,
  refreshToken: null,
  uid: null,
  authReady: false,
  setAuth: ({ idToken, refreshToken, uid }) => {
    console.log('🔐 setAuth', { uid });
    set({ idToken, refreshToken, uid });
  },
  clearAuth: () => {
    console.log('🚪 clearAuth');
    set({ idToken: null, refreshToken: null, uid: null });
  },
  setAuthReady: (authReady) => {
    console.log('✅ authReady', authReady);
    set({ authReady });
  },
  refreshIdToken: async () => {
    const service = await import('@/services/authService');
    try {
      const token = await service.refreshIdToken();
      return token;
    } catch {
      return null;
    }
  },
}))
