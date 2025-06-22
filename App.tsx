import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import ErrorBoundary from './App/components/common/ErrorBoundary';
import { useFonts, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Merriweather_400Regular } from '@expo-google-fonts/merriweather';
import * as SafeStore from '@/utils/secureStore';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUser } from '@/hooks/useUser';
import { loadUser } from '@/services/userService';
import { getStoredToken } from './App/services/authService';
import StartupAnimation from './App/components/common/StartupAnimation';

import { RootStackParamList } from './App/navigation/RootStackParamList';
import { useTheme } from './App/components/theme/theme';

// Auth Screens
import LoginScreen from './App/screens/auth/LoginScreen';
import SignupScreen from './App/screens/auth/SignupScreen';
import WelcomeScreen from './App/screens/auth/WelcomeScreen';
import ForgotPasswordScreen from './App/screens/auth/ForgotPasswordScreen';
import ForgotUsernameScreen from './App/screens/auth/ForgotUsernameScreen';
import OnboardingScreen from './App/screens/auth/OnboardingScreen';
import SelectReligionScreen from './App/screens/auth/SelectReligionScreen';
import OrganizationSignupScreen from './App/screens/auth/OrganizationSignupScreen';

// Dashboard Screens
import HomeScreen from './App/screens/dashboard/HomeScreen';
import ChallengeScreen from './App/screens/dashboard/ChallengeScreen';
import UpgradeScreen from './App/screens/dashboard/UpgradeScreen';
import LeaderboardsScreen from './App/screens/dashboard/LeaderboardScreen';
import TriviaScreen from './App/screens/dashboard/TriviaScreen';
import SubmitProofScreen from './App/screens/dashboard/SubmitProofScreen';

// Profile Screens
import ProfileScreen from './App/screens/profile/ProfileScreen';
import SettingsScreen from './App/screens/profile/SettingsScreen';
import OrganizationManagementScreen from './App/screens/profile/OrganizationManagmentScreen';
import JoinOrganizationScreen from './App/screens/profile/JoinOrganizationScreen';

// Root-Level Screens
import QuoteScreen from './App/screens/QuoteScreen';
import ReligionAIScreen from './App/screens/ReligionAIScreen';
import JournalScreen from './App/screens/JournalScreen';
import ConfessionalScreen from './App/screens/ConfessionalScreen';
import BuyTokensScreen from './App/screens/BuyTokensScreen';
import GiveBackScreen from './App/screens/GiveBackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { user } = useUser();
  const theme = useTheme();
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Merriweather_400Regular,
  });
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | undefined>();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAnim, setShowAnim] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      console.log('✅ Fonts loaded');
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const initialize = async () => {
      console.log('🔑 Checking saved auth credentials');
      try {
        const uid = await SafeStore.getItem('userId');
        const token = await getStoredToken();
        if (uid && token) {
          await loadUser(uid);
          console.log('✅ Authenticated user', uid);
          const hasSeen = await SafeStore.getItem(`hasSeenOnboarding-${uid}`);
          const route = hasSeen === 'true' ? 'Quote' : 'Onboarding';
          console.log('🔀 Initial route', route);
          setInitialRoute(route);

          const { init } = await import('./App/utils/TokenManager');
          init?.();
        } else {
          console.log('👤 No auth found, routing to Login');
          setInitialRoute('Login');
        }
      } catch (err) {
        console.error('❌ Auth load error:', err);
        setInitialRoute('Login');
      } finally {
        setCheckingAuth(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (user) {
      console.log('🙋 User state updated:', user.uid);
      setInitialRoute((prev) => prev ?? 'Home');
    }
  }, [user]);

  if (!fontsLoaded || checkingAuth || (!initialRoute && user)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  console.log('🚀 Rendering navigator with initial route', user ? initialRoute : 'Login');
  return (
    <ErrorBoundary>
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? initialRoute : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20, fontFamily: theme.fonts.title },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
            <Stack.Screen name="ForgotUsername" component={ForgotUsernameScreen} options={{ title: 'Find Email' }} />
            <Stack.Screen name="OrganizationSignup" component={OrganizationSignupScreen} options={{ title: 'Create Organization' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Quote" component={QuoteScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SelectReligion" component={SelectReligionScreen} options={{ title: 'Select Religion' }} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="ReligionAI" component={ReligionAIScreen} options={{ title: 'Religion AI' }} />
            <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Quiet Journal' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Daily Challenge' }} />
            <Stack.Screen name="Confessional" component={ConfessionalScreen} options={{ title: 'Confessional' }} />
            <Stack.Screen name="BuyTokens" component={BuyTokensScreen} options={{ title: 'Buy Tokens' }} />
            <Stack.Screen name="Upgrade" component={UpgradeScreen} options={{ title: 'Upgrade to OneVine+' }} />
            <Stack.Screen name="GiveBack" component={GiveBackScreen} options={{ title: 'Give Back' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Trivia" component={TriviaScreen} options={{ title: 'Trivia Challenge' }} />
            <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} options={{ title: 'Leaderboards' }} />
            <Stack.Screen name="SubmitProof" component={SubmitProofScreen} options={{ title: 'Submit Proof' }} />
            <Stack.Screen name="OrganizationManagement" component={OrganizationManagementScreen} options={{ title: 'Manage Organization' }} />
            <Stack.Screen name="JoinOrganization" component={JoinOrganizationScreen} options={{ title: 'Join Organization' }} />
          </>
        )}
      </Stack.Navigator>
      {showAnim && <StartupAnimation onDone={() => setShowAnim(false)} />}
    </NavigationContainer>
    </ErrorBoundary>
  );
}
