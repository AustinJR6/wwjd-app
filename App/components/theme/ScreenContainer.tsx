import React from 'react';
import { View, StyleSheet } from 'react-native';
import Background from '@/components/theme/Background';
import { useTheme } from '@/components/theme/theme';
import Header from '@/components/common/Header';

export default function ScreenContainer({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: theme.spacing.lg,
          justifyContent: 'center',
          width: '100%',
        },
      }),
    [theme],
  );
  return (
    <Background>
      <View style={styles.container}>
        <Header />
        {children}
      </View>
    </Background>
  );
}
