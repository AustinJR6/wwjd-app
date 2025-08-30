import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useThemeX } from '@/theme/ThemeProvider';
import { radius, shadow, space } from '@/theme/spacing';

export const Card: React.FC<{ style?: ViewStyle; children: React.ReactNode }> = ({ style, children }) => {
  const { palette } = useThemeX();
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: radius['2xl'],
          padding: space.lg,
          borderWidth: 1,
          borderColor: palette.border,
          ...shadow.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default Card;
