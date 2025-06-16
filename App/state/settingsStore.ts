import { create } from 'zustand'

interface SettingsState {
  nightMode: boolean
  toggleNightMode: () => void
  setNightMode: (value: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  nightMode: false,
  toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),
  setNightMode: (value) => set({ nightMode: value }),
}))
