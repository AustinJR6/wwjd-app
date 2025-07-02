import { create } from "zustand";

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  religion: string;
  region: string;
  organizationId?: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  tokens: number;
}

interface UserStore {
  user: UserData | null;
  setUser: (user: UserData) => void;
  updateUser: (updates: Partial<UserData>) => void;
  clearUser: () => void;
  updateTokens: (tokens: number) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,

  setUser: (user) => set({ user }),

  updateUser: (updates) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, ...updates } };
    }),

  clearUser: () => set({ user: null }),

  updateTokens: (tokens) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, tokens } };
    }),
}));
