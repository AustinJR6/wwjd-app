import { create } from 'zustand'

interface SettingsState {
  nightMode: boolean
  toggleNightMode: () => void
  setNightMode: (value: boolean) => void
  reminderEnabled: boolean
  reminderTime: string
  setReminderEnabled: (val: boolean) => void
  setReminderTime: (time: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  nightMode: false,
  toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),
  setNightMode: (value) => set({ nightMode: value }),
  reminderEnabled: false,
  reminderTime: '19:00',
  setReminderEnabled: (val) => set({ reminderEnabled: val }),
  setReminderTime: (time) => set({ reminderTime: time }),
}))
