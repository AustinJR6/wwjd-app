// theme.ts
import { useSettingsStore } from '@/state/settingsStore'

// Unified visual language tokens
const common = {
  radii: { sm: 8, md: 14, lg: 22, xl: 28 },
  spacing: { xs: 6, sm: 10, md: 16, lg: 22, xl: 28, xxl: 36 },
  fonts: {
    title: 'Poppins_600SemiBold',
    body: 'Merriweather_400Regular',
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
    h2: { fontSize: 22, fontWeight: '700', letterSpacing: 0.2 },
    title: { fontSize: 18, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '500' },
    caption: { fontSize: 13 },
  },
}

const lightColors = {
  // Identity
  brand: '#2F7A34',
  brandDark: '#1E5B22',
  brandLite: '#E8F5EA',
  amber: '#E0A100',

  // Surfaces & text
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  text: '#121212',
  subtext: '#5A5A5A',
  border: '#E7E7E7',

  // States
  danger: '#C0392B',
  success: '#27AE60',

  // Other
  shadow: 'rgba(16,24,40,0.12)',

  // Back-compat aliases
  background: '#FAFAF9',
  primary: '#2F7A34',
  accent: '#2F7A34',
  fadedText: '#5A5A5A',
  gray: '#888888',
  card: '#FFFFFF',
  inputBackground: '#FFFFFF',
  buttonText: '#F8F8F0',
}

const darkColors = {
  // Identity (brightened for dark)
  brand: '#3ECF5E',
  brandDark: '#2AA04A',
  brandLite: '#15361B',
  amber: '#FFC04D',

  // Surfaces & text
  bg: '#0F1115',
  surface: '#151922',
  text: '#F5F7FA',
  subtext: '#A9B1BC',
  border: '#273043',

  // States
  danger: '#E74C3C',
  success: '#2ECC71',

  // Other
  shadow: 'rgba(0,0,0,0.45)',

  // Back-compat aliases
  background: '#0F1115',
  primary: '#3ECF5E',
  accent: '#3ECF5E',
  fadedText: '#A9B1BC',
  gray: '#AAAAAA',
  card: '#151922',
  inputBackground: '#151922',
  buttonText: '#e6f0e5',
}

export const lightTheme = {
  colors: lightColors,
  ...common,
  shadowStyle: {
    shadowColor: 'rgba(16,24,40,0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
}

export const darkTheme = {
  colors: darkColors,
  ...common,
  typography: {
    ...common.typography,
    caption: { ...common.typography.caption, color: '#A9B1BC' },
  },
  shadowStyle: {
    shadowColor: 'rgba(0,0,0,0.45)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 10,
  },
}

export function useTheme() {
  const nightMode = useSettingsStore((s) => s.nightMode)
  return nightMode ? darkTheme : lightTheme
}
