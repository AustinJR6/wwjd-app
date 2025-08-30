import React from 'react';
import { TextInput, View, Text, TextInputProps, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useThemeX } from '@/theme/ThemeProvider';
import { space, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export const Input: React.FC<Props> = ({ label, containerStyle, inputStyle, ...props }) => {
  const { palette } = useThemeX();
  return (
    <View style={[{ marginBottom: space.lg }, containerStyle]}>
      {label ? (
        <Text style={[typography.caption, { color: palette.textMuted, marginBottom: 6 }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...props}
        placeholderTextColor={palette.textMuted}
        style={[{
          color: palette.text,
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          paddingVertical: 12,
          paddingHorizontal: space.md,
          borderRadius: radius.lg,
        }, inputStyle]}
      />
    </View>
  );
};
