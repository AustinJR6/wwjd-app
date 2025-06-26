import { create } from 'zustand'

interface AuthState {
  idToken: string | null
  refreshToken: string | null
  uid: string | null
  authReady: boolean
  setAuth: (data: { idToken: string; refreshToken: string; uid: string }) => void
  clearAuth: () => void
  setAuthReady: (ready: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  idToken: null,
  refreshToken: null,
  uid: null,
  authReady: false,
  setAuth: ({ idToken, refreshToken, uid }) => set({ idToken, refreshToken, uid }),
  clearAuth: () => set({ idToken: null, refreshToken: null, uid: null }),
  setAuthReady: (authReady) => set({ authReady }),
}))
