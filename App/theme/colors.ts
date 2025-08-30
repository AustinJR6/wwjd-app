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

// Light: Meadow — soft natural greens with warm amber accents
export const Dawn: Palette = {
  background: '#EAF5EE',        // airy green-tinted background
  surface:    '#F2F8F4',
  card:       '#FFFFFF',
  overlay:    'rgba(20, 80, 40, 0.06)',
  text:       '#0F1A14',        // deep green-black
  textMuted:  '#6B8A78',        // muted sage
  primary:    '#F5B836',        // warm amber
  primaryAlt: '#EAA215',        // earthy amber
  accent:     '#93C5FD',        // sky blue
  border:     '#DAE7DE',
  success:    '#10B981',
  warning:    '#F59E0B',
  error:      '#EF4444',
  // meadow gradient: mint → soft sage
  gradientPrimary: ['#E7F6EC', '#CFEAD6'],
  glass:      'rgba(255,255,255,0.55)',
};

// Dark: Candlelight — deep navy charcoal with warm candle amber and soft lavender accents
export const Midnight: Palette = {
  background: '#0A0F1F',
  surface:    '#121728',
  card:       '#161C30',
  overlay:    'rgba(255, 255, 255, 0.05)',
  text:       '#E6E8EF',
  textMuted:  '#AAB0C2',
  primary:    '#E5A64E',        // candle amber
  primaryAlt: '#C97F2B',        // warm muted amber-red
  accent:     '#C4B5FD',        // soft lavender
  border:     '#232A46',
  success:    '#34D399',
  warning:    '#FBBF24',
  error:      '#F87171',
  // night sky gradient: deep navy → charcoal
  gradientPrimary: ['#0B1126', '#1B2238'],
  glass:      'rgba(22, 28, 48, 0.6)',
};
