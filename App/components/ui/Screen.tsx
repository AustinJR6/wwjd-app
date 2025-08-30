import React from 'react';
import { View, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeX } from '@/theme/ThemeProvider';
import { space } from '@/theme/spacing';

export const Screen: React.FC<{ children: React.ReactNode; padded?: boolean }>
  = ({ children, padded = true }) => {
  const { palette } = useThemeX();
  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <LinearGradient
        colors={palette.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ height: 120, opacity: 0.22 }}
      />
      <ScrollView contentContainerStyle={{ padding: padded ? space.xl : 0 }}>
        {children}
      </ScrollView>
    </View>
  );
};

export default Screen;
