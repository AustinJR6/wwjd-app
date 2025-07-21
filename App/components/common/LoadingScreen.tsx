import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/components/theme/theme';
import CustomText from '@/components/CustomText';

export default function LoadingScreen({ message }: { message?: string }) {
  const theme = useTheme();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        },
      }),
    [theme],
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      {message ? (
        <CustomText style={{ marginTop: 8, color: theme.colors.text }}>
          {message}
        </CustomText>
      ) : null}
    </View>
  );
}
