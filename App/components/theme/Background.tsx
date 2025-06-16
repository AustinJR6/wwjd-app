import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/theme/theme';
import { useThemeAssets } from '@/components/theme/themeAssets';

export default function Background({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const assets = useThemeAssets();
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
        colors={assets.bgGradient}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

