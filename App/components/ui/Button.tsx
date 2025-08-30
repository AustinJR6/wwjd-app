import React from 'react';
import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';
import { useThemeX } from '@/theme/ThemeProvider';
import { space, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Variant = 'primary' | 'outline' | 'ghost';

export const Button: React.FC<{
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  disabled?: boolean;
  color?: string;
}> = ({ title, onPress, loading, variant = 'primary', style, disabled, color }) => {
  const { palette } = useThemeX();
  const base: ViewStyle = {
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const bgColor = color && variant === 'primary' ? color : palette.primary;
  const stylesBy: ViewStyle =
    variant === 'primary'
      ? { backgroundColor: bgColor }
      : variant === 'outline'
      ? { borderWidth: 1, borderColor: color || palette.border, backgroundColor: 'transparent' }
      : { backgroundColor: 'transparent' };

  const textColor = variant === 'primary' ? '#FFFFFF' : (color || palette.text);

  return (
    <Pressable onPress={onPress} style={[base, stylesBy, style, (disabled || loading) ? { opacity: 0.6 } : null]} disabled={!!(loading || disabled)}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.bodyBold, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
};

export default Button;
