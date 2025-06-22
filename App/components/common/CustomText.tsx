import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '@/components/theme/theme';

export default function CustomText({ style, ...props }: TextProps) {
  const theme = useTheme();
  const combined: StyleProp<TextStyle> = [{ fontFamily: theme.fonts.body }, style];
  return <Text allowFontScaling={false} style={combined} {...props} />;
}
