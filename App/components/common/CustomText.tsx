import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../theme/theme';

export default function CustomText(props: TextProps) {
  const theme = useTheme();
  return (
    <Text allowFontScaling={false} {...props} style={[{ fontFamily: theme.fonts.body }, props.style]} />
  );
}
