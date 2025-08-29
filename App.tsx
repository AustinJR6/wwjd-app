import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import ErrorBoundary from './App/components/common/ErrorBoundary';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather';
import AuthGate from './App/navigation/AuthGate';
import ThemeSyncProvider from './App/components/theme/ThemeSyncProvider';
import StartupAnimation from './App/components/common/StartupAnimation';
import Constants from 'expo-constants';
import { useTheme } from './App/components/theme/theme';

const dsn = process.env.SENTRY_DSN || process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!dsn || dsn.includes('your-key')) {
  console.warn('Sentry DSN not configured. Skipping Sentry initialization.');
} else {
  Sentry.init({ dsn });
}

const isExpoGo = Constants.appOwnership === 'expo';

export default function App() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Merriweather_400Regular,
  });
  const [showAnim, setShowAnim] = useState(true);

  useEffect(() => {
    if (isExpoGo) {
      console.warn(
        '⚠️ Running in Expo Go. Push notifications and Firebase Auth may not work as expected.',
      );
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <StripeProvider
      publishableKey={Constants.expoConfig?.extra?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
      urlScheme="onevine"
      merchantIdentifier="merchant.com.onevine.app"
    >
      <ErrorBoundary>
        <ThemeSyncProvider>
          <AuthGate />
          {showAnim && <StartupAnimation onDone={() => setShowAnim(false)} />}
        </ThemeSyncProvider>
      </ErrorBoundary>
    </StripeProvider>
  );
}
