import React from 'react';
import { View, StyleSheet } from 'react-native';
import Background from '@/components/theme/Background'; // ✅ Corrected relative import to alias
import { theme } from '@/components/theme/theme'; // ✅ Corrected alias for theme

export default function ScreenContainer({ children }: { children: React.ReactNode }) {
  return (
    <Background>
      <View style={styles.container}>{children}</View>
    </Background>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    width: '100%',
  },
});
