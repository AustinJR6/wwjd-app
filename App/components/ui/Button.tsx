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
    borderRadius: 999, // pill style
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        stylesBy,
        style,
        (disabled || loading) ? { opacity: 0.55 } : null,
        pressed && !disabled ? { transform: [{ scale: 0.98 }], shadowOpacity: 0.12 } : null,
      ]}
      disabled={!!(loading || disabled)}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typography.bodyBold, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
};

export default Button;
