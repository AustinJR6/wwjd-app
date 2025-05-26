import { create } from 'zustand';
import { firebaseAuth } from "@/config/firebaseConfig";
import firestore from '@react-native-firebase/firestore';

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
    const user = firebaseAuth.currentUser;
    if (!user) return;

    const ref = firestore().collection('completedChallenges').doc(user.uid);
    const snap = await ref.get();

    if (snap.exists()) {
      const data = snap.data();
      set({
        lastCompleted: data?.lastCompleted?.toDate?.().getTime() || null,
        streak: data?.streak || 0,
      });
    }
  },

  updateStreakInFirestore: async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    const { lastCompleted, streak } = get();
    const ref = firestore().collection('completedChallenges').doc(user.uid);

    await ref.set({
      lastCompleted: lastCompleted ? new Date(lastCompleted) : firestore.FieldValue.serverTimestamp(),
      streak,
    }, { merge: true });
  },
}));
