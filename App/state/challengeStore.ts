import { create } from 'zustand'

interface ChallengeStore {
  lastCompleted: number | null
  streak: number
  setLastCompleted: (timestamp: number) => void
  incrementStreak: () => void
  resetStreak: () => void
}

export const useChallengeStore = create<ChallengeStore>((set) => ({
  lastCompleted: null,
  streak: 0,
  setLastCompleted: (timestamp) => set({ lastCompleted: timestamp }),
  incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
  resetStreak: () => set({ streak: 0 })
}))
