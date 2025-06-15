import { create } from 'zustand';
import { firestore } from '@/config/firebase';
import { doc, getDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { ensureAuth } from '@/utils/authGuard';

async function getUid(): Promise<string | null> {
  return await SecureStore.getItemAsync('localId');
}

interface ChallengeStore {
  lastCompleted: number | null;
  streak: number;
  setLastCompleted: (timestamp: number) => void;
  incrementStreak: () => void;
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
  },

  resetStreak: () => {
    set({ streak: 0 });
    get().updateStreakInFirestore();
  },

  syncWithFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const ref = doc(collection(firestore, 'completedChallenges'), uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      set({
        lastCompleted: data?.lastCompleted?.toDate?.().getTime() || null,
        streak: data?.streak || 0,
      });
    }
  },

  updateStreakInFirestore: async () => {
    const uid = await ensureAuth();
    if (!uid) return;

    const { lastCompleted, streak } = get();
    const ref = doc(collection(firestore, 'completedChallenges'), uid);

    await setDoc(
      ref,
      {
        lastCompleted: lastCompleted ? new Date(lastCompleted) : serverTimestamp(),
        streak,
      },
      { merge: true }
    );
  },
}));
