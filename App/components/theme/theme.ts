// theme.ts
import { useSettingsStore } from '@/state/settingsStore'

const lightColors = {
  background: '#fdf8ee',
  surface: '#fdf8ee',
  text: '#3B2F2F',
  fadedText: '#6D4C41',
  primary: '#4B7B2D',
  accent: '#4B7B2D',
  success: '#3C6B4C',
  warning: '#FDD835',
  danger: '#E57373',
  border: '#A89F91',
  gray: '#888888',
  card: '#fdf8ee',
  inputBackground: '#fdf8ee',
  buttonText: '#F8F8F0',
}

const darkColors = {
  background: '#102d1f',
  surface: '#102d1f',
  text: '#e6f0e5',
  fadedText: '#b9cfa3',
  primary: '#348256',
  accent: '#348256',
  success: '#348256',
  warning: '#FDD835',
  danger: '#E57373',
  border: '#b9cfa3',
  gray: '#AAAAAA',
  card: '#1e3c2e',
  inputBackground: '#1e3c2e',
  buttonText: '#e6f0e5',
}

export const lightTheme = {
  colors: lightColors,
  fonts: {
    title: 'Poppins_600SemiBold',
    body: 'Merriweather_400Regular',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
}

export const darkTheme = {
  ...lightTheme,
  colors: darkColors,
}

export function useTheme() {
  const nightMode = useSettingsStore((s) => s.nightMode)
  return nightMode ? darkTheme : lightTheme
}
