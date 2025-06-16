import { create } from 'zustand';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getDocument } from '@/services/firestoreService';
import { getTokenCount } from '@/utils/TokenManager';
import { ensureAuth } from '@/utils/authGuard';
import { useChallengeStore } from './challengeStore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  religion: string;
  region?: string;
  organizationId?: string;
}

interface UserDataState {
  userProfile: UserProfile | null;
  tokenCount: number;
  isSubscribed: boolean;
  streak: number;
  loading: boolean;
}

interface UserDataActions {
  initialize: () => void;
  refresh: () => Promise<void>;
  setTokenCount: (count: number) => void;
  clear: () => void;
}

export const useUserDataStore = create<UserDataState & UserDataActions>((set) => ({
  userProfile: null,
  tokenCount: 0,
  isSubscribed: false,
  streak: 0,
  loading: true,

  initialize: () => {
    onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        await useUserDataStore.getState().refresh();
      } else {
        set({ userProfile: null, tokenCount: 0, isSubscribed: false, streak: 0 });
      }
      set({ loading: false });
    });
  },

  refresh: async () => {
    const uid = await ensureAuth();
    if (!uid) return;
    try {
      const [profile, tokens] = await Promise.all([
        getDocument(`users/${uid}`),
        getTokenCount(),
      ]);
      const streak = useChallengeStore.getState().streak;
      set({
        userProfile: profile || null,
        tokenCount: tokens ?? 0,
        isSubscribed: profile?.isSubscribed ?? false,
        streak: streak ?? 0,
      });
    } catch (err) {
      console.error('Failed to load user data', err);
    }
  },

  setTokenCount: (count: number) => set({ tokenCount: count }),

  clear: () => set({ userProfile: null, tokenCount: 0, isSubscribed: false, streak: 0 }),
}));
