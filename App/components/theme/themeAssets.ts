export interface ThemeAssets {
  bgGradient: string[];
  buttonGradient: string[];
  glow: string;
}

const lightAssets: ThemeAssets = {
  bgGradient: ['#fdf8ee', '#eaf7d4'],
  buttonGradient: ['#4B7B2D', '#6bb34f'],
  glow: 'rgba(255,255,255,0.6)',
};

const darkAssets: ThemeAssets = {
  bgGradient: ['#102d1f', '#07140b'],
  buttonGradient: ['#348256', '#3aa56b'],
  glow: 'rgba(255,255,255,0.3)',
};

import { useSettingsStore } from '@/state/settingsStore';
export function useThemeAssets(): ThemeAssets {
  const nightMode = useSettingsStore((s) => s.nightMode);
  return nightMode ? darkAssets : lightAssets;
}
