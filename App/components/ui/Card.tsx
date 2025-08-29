import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/components/theme/theme';

export default function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useTheme();
  return <View style={[styles(theme).card, (theme as any).shadowStyle, style]}>{children}</View>;
}

const styles = (t:any) => StyleSheet.create({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.lg,
    padding: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
});

