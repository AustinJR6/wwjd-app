import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/components/theme/theme'; // ✅ Fixed alias and removed extension

export default function Background({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[theme.colors.background, '#1a1f2b']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
});
