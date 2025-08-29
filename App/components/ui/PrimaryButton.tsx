import React, { useRef } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, Animated } from 'react-native';
import { useTheme } from '@/components/theme/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  outline?: boolean;
  amber?: boolean; // accent style
};

export default function PrimaryButton({ title, onPress, loading, disabled, style, small, outline, amber }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(pressAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const handlePressOut = () => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  const base = [
    s.base,
    outline ? s.outline : (amber ? s.filledAmber : s.filled),
    small && s.small,
    (disabled || loading) && s.disabled,
    (theme as any).shadowStyle,
    style,
  ];

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={base}
      >
        {loading ? <ActivityIndicator /> : (
          <Text style={[s.text, outline && s.textOutline, amber && s.textOnAmber, small && { fontSize: 15 }]}>{title}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = (t: any) => StyleSheet.create({
  base: {
    borderRadius: t.radii.lg,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: t.colors.brand },
  filledAmber: { backgroundColor: t.colors.amber },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.colors.brand },
  text: { color: 'white', ...(t.typography?.title || {}) },
  textOnAmber: { color: '#151515' },
  textOutline: { color: t.colors.brand },
  small: { paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.lg },
  disabled: { opacity: 0.6 },
});

