import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/components/theme/theme';

export default function SuccessBanner({ text, visible }: { text: string; visible: boolean }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[styles(theme).wrap, { opacity }]}> 
      <Text style={styles(theme).txt}>{text}</Text>
    </Animated.View>
  );
}

const styles = (t:any) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: t.spacing.lg,
    alignSelf: 'center',
    backgroundColor: t.colors.brand,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.sm,
    borderRadius: t.radii.lg,
    ...(t as any).shadowStyle,
  },
  txt: { color: 'white', ...(t.typography?.title || {}) },
});

