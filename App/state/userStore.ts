import { create } from "zustand";

interface UserData {
  uid: string;
  email: string;
  username: string;
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

export const useUserStore = create<UserStore>((set: any) => ({
  user: null,

  setUser: (user: UserData) => set({ user }),

  updateUser: (updates: Partial<UserData>) =>
    set((state: UserStore) => {
      if (!state.user) return state;
      return { user: { ...state.user, ...updates } };
    }),

  clearUser: () => set({ user: null }),

  updateTokens: (tokens: number) =>
    set((state: UserStore) => {
      if (!state.user) return state;
      return { user: { ...state.user, tokens } };
    }),
}));
