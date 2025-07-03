import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef } from './navigationRef';
import { RootStackParamList } from './RootStackParamList';
import { useTheme } from '@/components/theme/theme';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { useUserStore } from '@/state/userStore';
import { initAuthState } from '@/services/authService';
import { fetchUserProfile } from '@/services/userService';

// Auth Screens
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ForgotUsernameScreen from '@/screens/auth/ForgotUsernameScreen';
import OnboardingScreen from '@/screens/auth/OnboardingScreen';
import SelectReligionScreen from '@/screens/auth/SelectReligionScreen';
import OrganizationSignupScreen from '@/screens/auth/OrganizationSignupScreen';

// Dashboard Screens
import HomeScreen from '@/screens/dashboard/HomeScreen';
import ChallengeScreen from '@/screens/dashboard/ChallengeScreen';
import UpgradeScreen from '@/screens/dashboard/UpgradeScreen';
import LeaderboardScreen from '@/screens/dashboard/LeaderboardScreen';
import TriviaScreen from '@/screens/dashboard/TriviaScreen';
import SubmitProofScreen from '@/screens/dashboard/SubmitProofScreen';

// Profile Screens
import ProfileScreen from '@/screens/profile/ProfileScreen';
import SettingsScreen from '@/screens/profile/SettingsScreen';
import OrganizationManagementScreen from '@/screens/profile/OrganizationManagementScreen';
import JoinOrganizationScreen from '@/screens/profile/JoinOrganizationScreen';
import ChangePasswordScreen from '@/screens/profile/ChangePasswordScreen';

// Root-Level Screens
import QuoteScreen from '@/screens/QuoteScreen';
import ReligionAIScreen from '@/screens/ReligionAIScreen';
import JournalScreen from '@/screens/JournalScreen';
import ConfessionalScreen from '@/screens/ConfessionalScreen';
import BuyTokensScreen from '@/screens/BuyTokensScreen';
import GiveBackScreen from '@/screens/GiveBackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthGate() {
  const theme = useTheme();
  const { uid, idToken, authReady } = useAuth();
  const { user } = useUser();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    initAuthState();
  }, []);

  useEffect(() => {
    async function verify() {
      if (!authReady) return;
      console.log('🔍 AuthGate verify', { uid, hasToken: !!idToken });

      if (!uid || !idToken) {
        console.log('➡️ route -> Login');
        setInitialRoute('Login');
        setChecking(false);
        return;
      }

      let profile = useUserStore.getState().user;
      if (!profile || profile.uid !== uid) {
        try {
          profile = await fetchUserProfile(uid);
          if (profile) {
            useUserStore.getState().setUser({
              uid: profile.uid,
              email: profile.email,
              displayName: profile.displayName ?? '',
              religion: profile.religion,
              region: profile.region ?? '',
              organizationId: profile.organizationId,
              isSubscribed: profile.isSubscribed,
              onboardingComplete: profile.onboardingComplete,
              tokens: 0,
            });
          }
        } catch (err) {
          console.warn('Failed to fetch profile', err);
          setInitialRoute('Login');
          setChecking(false);
          return;
        }
      }

      if (!profile) {
        console.log('➡️ route -> Login');
        setInitialRoute('Login');
        setChecking(false);
        return;
      }

      console.log('➡️ route -> Home');
      setInitialRoute('Home');
      setChecking(false);
    }
    verify();
  }, [authReady, uid, idToken]);

  useEffect(() => {
    if (initialRoute) {
      console.log('🧭 initialRoute set', { initialRoute });
    }
  }, [initialRoute]);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
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
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Trivia" component={TriviaScreen} options={{ title: 'Trivia Challenge' }} />
            <Stack.Screen name="Leaderboards" component={LeaderboardScreen} options={{ title: 'Leaderboards' }} />
            <Stack.Screen name="SubmitProof" component={SubmitProofScreen} options={{ title: 'Submit Proof' }} />
            <Stack.Screen name="OrganizationManagement" component={OrganizationManagementScreen} options={{ title: 'Manage Organization' }} />
            <Stack.Screen name="JoinOrganization" component={JoinOrganizationScreen} options={{ title: 'Join Organization' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

