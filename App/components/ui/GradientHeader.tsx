import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/theme/theme';

export default function GradientHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <LinearGradient colors={[theme.colors.brand, theme.colors.brandDark]} start={{x:0,y:0}} end={{x:1,y:1}} style={s.wrap}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </LinearGradient>
  );
}

const styles = (t:any) => StyleSheet.create({
  wrap: { borderRadius: t.radii.xl, paddingVertical: t.spacing.lg, paddingHorizontal: t.spacing.xl, marginBottom: t.spacing.lg },
  title: { color: 'white', ...(t.typography?.h1 || { fontSize: 28, fontWeight: '700' }) },
  subtitle: { color: 'white', opacity: 0.9, marginTop: 4 },
});

