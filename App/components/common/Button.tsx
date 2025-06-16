import React from 'react';
import { Text, Pressable, StyleSheet, ActivityIndicator, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/components/theme/theme';
import { useThemeAssets } from '@/components/theme/themeAssets';
import { LinearGradient } from 'expo-linear-gradient';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}

export default function Button({ title, onPress, disabled, loading, color }: ButtonProps) {
  const theme = useTheme();
  const assets = useThemeAssets();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        button: {
          overflow: 'hidden',
          borderRadius: 24,
          marginVertical: 10,
          shadowColor: assets.glow,
          shadowOpacity: 0.6,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 10,
          elevation: 3,
          minHeight: 48,
        },
        gradient: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 14,
          borderRadius: 24,
        },
        pressed: {
          opacity: 0.9,
        },
        text: {
          color: theme.colors.buttonText,
          fontSize: 16,
          fontWeight: '600',
          fontFamily: theme.fonts.title,
        },
        disabled: {
          opacity: 0.5,
        },
      }),
    [theme],
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      onPressIn={() => { scale.value = withTiming(0.97); }}
      onPressOut={() => { scale.value = withTiming(1); }}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <LinearGradient
        colors={color ? [color, color] : assets.buttonGradient}
        style={styles.gradient}
      >
        <Animated.View style={animatedStyle}>
          {loading ? (
            <ActivityIndicator color={theme.colors.buttonText} />
          ) : (
            <Text style={styles.text}>{title}</Text>
          )}
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

// styles are created inside the component so they can react to theme changes

