export type Palette = {
  background: string;
  surface: string;
  card: string;
  overlay: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryAlt: string;
  accent: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  gradientPrimary: [string, string];
  glass: string;
};

export const Dawn: Palette = {
  background: '#F7F7FB',
  surface:    '#F3F4F8',
  card:       '#FFFFFF',
  overlay:    'rgba(15, 20, 35, 0.04)',
  text:       '#0F172A',
  textMuted:  '#64748B',
  primary:    '#6C5CE7',
  primaryAlt: '#7C83FF',
  accent:     '#22D3EE',
  border:     '#E5E7EB',
  success:    '#10B981',
  warning:    '#F59E0B',
  error:      '#EF4444',
  gradientPrimary: ['#7C83FF', '#6C5CE7'],
  glass:      'rgba(255,255,255,0.6)',
};

export const Midnight: Palette = {
  background: '#0B1020',
  surface:    '#11162A',
  card:       '#141A2F',
  overlay:    'rgba(255,255,255,0.03)',
  text:       '#E5E7EB',
  textMuted:  '#A1A7B7',
  primary:    '#7C83FF',
  primaryAlt: '#6C5CE7',
  accent:     '#22D3EE',
  border:     '#1F2540',
  success:    '#34D399',
  warning:    '#FBBF24',
  error:      '#F87171',
  gradientPrimary: ['#7C83FF', '#6C5CE7'],
  glass:      'rgba(20,26,47,0.55)',
};

