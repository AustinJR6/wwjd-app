import { create } from 'zustand';
import { getDocument, setDocument } from '@/services/firestoreService';
import * as SafeStore from '@/utils/secureStore';
import { ensureAuth } from '@/utils/authGuard';

async function getUid(): Promise<string | null> {
  return await SafeStore.getItem('userId');
}

interface ChallengeStore {
  lastCompleted: number | null;
  streak: number;
  setLastCompleted: (timestamp: number) => void;
  incrementStreak: () => number;
  resetStreak: () => void;
  syncWithFirestore: () => Promise<void>;
  updateStreakInFirestore: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  lastCompleted: null,
  streak: 0,

  setLastCompleted: (timestamp) => set({ lastCompleted: timestamp }),

  incrementStreak: () => {
    const newStreak = get().streak + 1;
    set({ streak: newStreak });
    get().updateStreakInFirestore();
    return newStreak;
  },

  resetStreak: () => {
    set({ streak: 0 });
    get().updateStreakInFirestore();
  },

  syncWithFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const data = await getDocument(`completedChallenges/${uid}`);
    if (data) {
      set({
        lastCompleted: data.lastCompleted ? new Date(data.lastCompleted).getTime() : null,
        streak: data.streak || 0,
      });
    }
  },

  updateStreakInFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const { lastCompleted, streak } = get();
    const payload = {
      lastCompleted: lastCompleted ? new Date(lastCompleted).toISOString() : new Date().toISOString(),
      streak,
    };
    await setDocument(`completedChallenges/${uid}`, payload);
    await setDocument(`users/${uid}`, payload);
  },
}));
