import { create } from 'zustand';
import { app, firestore } from '@/config/firebase';
import { getAuth } from 'firebase/auth';

const auth = getAuth(app);
import { doc, getDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';

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
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(collection(firestore, 'completedChallenges'), user.uid);
    const snap = await getDoc(ref);

    if (snap.exists) {
      const data = snap.data();
      set({
        lastCompleted: data?.lastCompleted?.toDate?.().getTime() || null,
        streak: data?.streak || 0,
      });
    }
  },

  updateStreakInFirestore: async () => {
    const user = auth.currentUser;
    if (!user) return;

    const { lastCompleted, streak } = get();
    const ref = doc(collection(firestore, 'completedChallenges'), user.uid);

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
