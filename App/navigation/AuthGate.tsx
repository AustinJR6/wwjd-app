import React, { useEffect, useState } from 'react';

// Prevent multiple auth listeners on re-renders
let authInitialized = false;

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef } from './navigationRef';
import { RootStackParamList } from './RootStackParamList';
import { useTheme } from '@/components/theme/theme';
import LoadingScreen from '@/components/common/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/state/userStore';
import { useUserProfileStore } from '@/state/userProfile';
import { initAuthState } from '@/services/authService';
import { loadUserProfile } from '@/utils/userProfile';
import { refreshLastActive } from '@/services/userService';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';

// Auth Screens
import ProfileCompletionScreen from '@/screens/auth/ProfileCompletionScreen';
import WelcomeScreen from '@/screens/auth/WelcomeScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import ForgotUsernameScreen from '@/screens/auth/ForgotUsernameScreen';
import SelectReligionScreen from '@/screens/auth/SelectReligionScreen';

// Dashboard Screens
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

import BuyTokensScreen from '@/screens/BuyTokensScreen';
import GiveBackScreen from '@/screens/GiveBackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthGate() {
  const theme = useTheme();
  const { uid, idToken, authReady } = useAuth();
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Auth');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!authInitialized) {
      initAuthState();
      authInitialized = true;
    }
  }, []);

  useEffect(() => {
    async function verify() {
      if (!authReady) return;
      console.log('🔍 AuthGate verify', { uid, hasToken: !!idToken });

      if (!uid || !idToken) {
        console.log('➡️ route -> Auth');
        setInitialRoute('Auth');
        setChecking(false);
        return;
      }

      let profile = useUserStore.getState().user;
      if (!profile || profile.uid !== uid) {
        try {
          const fetched = await loadUserProfile(uid);
          if (fetched) {
            useUserProfileStore.getState().setUserProfile(fetched as any);
            useUserStore.getState().setUser({
              uid: fetched.uid,
              email: fetched.email,
              username: fetched.username ?? '',
              displayName: fetched.displayName ?? '',
              religion: fetched?.religion ?? 'SpiritGuide',
              region: fetched.region ?? '',
              organizationId: fetched.organizationId,
              isSubscribed: fetched?.isSubscribed ?? false,
              onboardingComplete: fetched.onboardingComplete ?? false,
              profileComplete: fetched.profileComplete ?? false,
              tokens: 0,
            });
            profile = useUserStore.getState().user;
          }
        } catch (err) {
          console.warn('Failed to fetch profile', err);
          setInitialRoute('Auth');
          setChecking(false);
          return;
        }
      }

      if (!profile) {
        console.log('➡️ route -> Auth');
        setInitialRoute('Auth');
        setChecking(false);
        return;
      }

      if (
        profile &&
        (profile.onboardingComplete === false || profile.onboardingComplete === undefined)
      ) {
        console.log('➡️ route -> ProfileCompletion');
        setInitialRoute('ProfileCompletion');
      } else {
        console.log('➡️ route -> MainTabs');
        setInitialRoute('MainTabs');
      }
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
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => {
        if (uid) refreshLastActive(uid);
      }}
    >
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20, fontFamily: theme.fonts.title },
        }}
      >
        <Stack.Screen name="Auth" component={AuthNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} options={{ title: 'Complete Profile' }} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
        <Stack.Screen name="ForgotUsername" component={ForgotUsernameScreen} options={{ title: 'Find Email' }} />
        <Stack.Screen name="SelectReligion" component={SelectReligionScreen} options={{ title: 'Select Religion' }} />
        <Stack.Screen name="Quote" component={QuoteScreen} options={{ headerShown: false }} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

