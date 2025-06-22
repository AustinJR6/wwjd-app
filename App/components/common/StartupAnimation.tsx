import React, { useEffect } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '@/components/theme/theme';

export default function StartupAnimation({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 }, () => {
      opacity.value = withTiming(0, { duration: 800 }, () => onDone());
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
        text: { fontSize: 32, color: theme.colors.primary, fontFamily: theme.fonts.title },
      }),
    [theme],
  );

  return (
    <Animated.View style={[styles.container, animStyle]} pointerEvents="none">
      <CustomText style={styles.text}>OneVine</CustomText>
    </Animated.View>
  );
}
