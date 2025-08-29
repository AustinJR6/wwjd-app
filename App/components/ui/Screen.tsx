import React, { PropsWithChildren } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useTheme } from '@/components/theme/theme';

export default function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const isDark = theme.colors.text === '#F5F7FA' || (theme.colors.bg || '').toLowerCase() === '#0f1115';
  const s = styles(theme);
  return (
    <View style={s.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {children}
    </View>
  );
}

const styles = (t:any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg, paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg },
});

