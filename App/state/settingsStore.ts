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

export const useSettingsStore = create<SettingsState>((set: any) => ({
  nightMode: false,
  toggleNightMode: () => set((s: SettingsState) => ({ nightMode: !s.nightMode })),
  setNightMode: (value: boolean) => set({ nightMode: value }),
  reminderEnabled: false,
  reminderTime: '19:00',
  setReminderEnabled: (val: boolean) => set({ reminderEnabled: val }),
  setReminderTime: (time: string) => set({ reminderTime: time }),
}))
