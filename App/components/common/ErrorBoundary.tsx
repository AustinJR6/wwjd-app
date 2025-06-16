import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/components/theme/theme';

export default class ErrorBoundary extends React.Component<{children: React.ReactNode}> {
  state = { hasError: false, error: null as any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  render() {
    const { hasError, error } = this.state as any;
    const theme = useTheme();
    if (hasError) {
      return (
        <View style={styles(theme).container}>
          <Text style={styles(theme).text}>Something went wrong.</Text>
          {error && <Text style={styles(theme).error}>{String(error)}</Text>}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: 16,
    },
    text: { color: theme.colors.text, marginBottom: 8, fontSize: 16 },
    error: { color: theme.colors.accent, textAlign: 'center' },
  });
