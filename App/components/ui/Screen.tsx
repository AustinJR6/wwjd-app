import React from 'react';
import { View, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeX } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';

export const Screen: React.FC<{ children: React.ReactNode; padded?: boolean }>
  = ({ children, padded = true }) => {
  const { palette } = useThemeX();
  const fade = React.useRef(new Animated.Value(0.85)).current;

  React.useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [palette.background]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <LinearGradient
          colors={palette.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.22 }}
          pointerEvents="none"
        />
        {/* Ambient decor */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: palette.overlay }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: -50, left: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: palette.overlay }} />

        <ScrollView contentContainerStyle={{ padding: padded ? space.xl : 0, flexGrow: 1 }}>
          {children}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

export default Screen;
