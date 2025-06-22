import CustomText from '@/components/common/CustomText';
import React from 'react';
import { View,  StyleSheet } from 'react-native';
import { useTheme } from '@/components/theme/theme';

interface BoundaryProps {
  children: React.ReactNode;
  theme: ReturnType<typeof useTheme>;
}

class Boundary extends React.Component<BoundaryProps> {
  state = { hasError: false, error: null as any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('Unhandled error caught by ErrorBoundary:', error, info);
  }

  render() {
    const { hasError, error } = this.state as any;
    const { theme } = this.props;
    if (hasError) {
      return (
        <View style={styles(theme).container}>
          <CustomText style={styles(theme).text}>Something went wrong.</CustomText>
          {error && <CustomText style={styles(theme).error}>{String(error)}</CustomText>}
        </View>
      );
    }
    return this.props.children;
  }
}

export default function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <Boundary theme={theme}>{children}</Boundary>;
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
