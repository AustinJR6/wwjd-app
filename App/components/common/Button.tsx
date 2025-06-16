import React from 'react';
import { Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { theme } from '@/components/theme/theme'; // ✅ Fixed path

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

export default function Button({ title, onPress, disabled, loading, color }: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color || theme.colors.primary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPressIn={() => { scale.value = withTiming(0.97); }}
      onPressOut={() => { scale.value = withTiming(1); }}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Animated.View style={animatedStyle}>
        {loading ? (
          <ActivityIndicator color={theme.colors.buttonText} />
        ) : (
          <Text style={styles.text}>{title}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    minHeight: 48,
  },
  pressed: {
    backgroundColor: theme.colors.success,
  },
  text: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    backgroundColor: theme.colors.gray,
  },
});
