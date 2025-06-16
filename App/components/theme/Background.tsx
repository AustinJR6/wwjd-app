import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/theme/theme';

export default function Background({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrapper: { flex: 1 },
        content: { flex: 1, padding: theme.spacing.lg },
      }),
    [theme],
  );
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[theme.colors.background, theme.colors.card]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

