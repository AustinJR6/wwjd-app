// theme.ts
import { useSettingsStore } from '@/state/settingsStore'

const lightColors = {
  background: '#F5F5E5',
  surface: '#EFE8D8',
  text: '#4E342E',
  fadedText: '#6D4C41',
  primary: '#6B8E23',
  accent: '#8FBC8F',
  success: '#556B2F',
  warning: '#FDD835',
  danger: '#E57373',
  border: '#A1887F',
  gray: '#888888',
  card: '#DDE4C9',
  inputBackground: '#F8F4EC',
  buttonText: '#F8F8F0',
}

const darkColors = {
  background: '#2E3C2F',
  surface: '#1B1F1A',
  text: '#F5F0E6',
  fadedText: '#CFC8B9',
  primary: '#3C6B4C',
  accent: '#3C6B4C',
  success: '#3C6B4C',
  warning: '#FDD835',
  danger: '#E57373',
  border: '#555',
  gray: '#AAAAAA',
  card: '#2E3C2F',
  inputBackground: '#1B1F1A',
  buttonText: '#F5F0E6',
}

export const lightTheme = {
  colors: lightColors,
  fonts: {
    title: 'System',
    body: 'System',
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
