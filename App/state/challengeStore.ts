import { create } from 'zustand';
import { getDocument, setDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

interface ChallengeStore {
  lastCompleted: number | null;
  streak: number;
  lastStreakDate: string | null;
  setLastCompleted: (timestamp: number) => void;
  incrementStreak: () => number;
  resetStreak: () => void;
  syncWithFirestore: () => Promise<void>;
  updateStreakInFirestore: () => Promise<void>;
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  lastCompleted: null,
  streak: 0,
  lastStreakDate: null,

  setLastCompleted: (timestamp) => set({ lastCompleted: timestamp }),

  incrementStreak: () => {
    const newStreak = get().streak + 1;
    const now = Date.now();
    set({ streak: newStreak, lastCompleted: now, lastStreakDate: new Date(now).toISOString() });
    get().updateStreakInFirestore();
    return newStreak;
  },

  resetStreak: () => {
    set({ streak: 0, lastCompleted: Date.now(), lastStreakDate: new Date().toISOString() });
    get().updateStreakInFirestore();
  },

  syncWithFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const data = await getDocument(`users/${uid}`);
    if (data) {
      set({
        lastCompleted: data.lastStreakDate ? new Date(data.lastStreakDate).getTime() : null,
        lastStreakDate: data.lastStreakDate || null,
        streak: data.streak || 0,
      });
    }
  },

  updateStreakInFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const { lastCompleted, streak } = get();
    const payload = {
      lastStreakDate: lastCompleted ? new Date(lastCompleted).toISOString() : new Date().toISOString(),
      streak,
    };
    await setDocument(`users/${uid}`, payload);
  },
}));
