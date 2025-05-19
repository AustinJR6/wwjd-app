import { create } from 'zustand'

interface UserData {
  uid: string
  email: string
  displayName: string
  religion: string
  isSubscribed: boolean
  tokens: number
}

interface UserStore {
  user: UserData | null
  setUser: (user: UserData) => void
  clearUser: () => void
  updateTokens: (tokens: number) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null }),

  updateTokens: (tokens) =>
    set((state) => {
      if (!state.user) return state
      return { user: { ...state.user, tokens } }
    }),
}))
