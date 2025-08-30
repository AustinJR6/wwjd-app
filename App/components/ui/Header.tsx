import React from 'react';
import { View, Text } from 'react-native';
import { useThemeX } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { space } from '@/theme/spacing';

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const { palette } = useThemeX();
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={[typography.h1, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.body, { color: palette.textMuted, marginTop: 4 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

