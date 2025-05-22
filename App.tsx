import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { firebase } from '@react-native-firebase/auth'; // ✅ Correct Firebase module instance
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

import { RootStackParamList } from './App/navigation/RootStackParamList.ts';
import { theme } from './App/components/theme/theme.ts';

// Auth Screens
import LoginScreen from './App/screens/auth/LoginScreen.tsx';
import SignupScreen from './App/screens/auth/SignupScreen.tsx';
import OnboardingScreen from './App/screens/auth/OnboardingScreen.tsx';
import SelectReligionScreen from './App/screens/auth/SelectReligionScreen.tsx';
import OrganizationSignupScreen from './App/screens/auth/OrganizationSignupScreen.tsx';

// Dashboard Screens
import HomeScreen from './App/screens/dashboard/HomeScreen.tsx';
import ChallengeScreen from './App/screens/dashboard/ChallengeScreen.tsx';
import StreakScreen from './App/screens/dashboard/StreakScreen.tsx';
import UpgradeScreen from './App/screens/dashboard/UpgradeScreen.tsx';
import LeaderboardsScreen from './App/screens/dashboard/LeaderboardScreen.tsx';
import TriviaScreen from './App/screens/dashboard/TriviaScreen.tsx';
import SubmitProofScreen from './App/screens/dashboard/SubmitProofScreen.tsx';

// Profile Screens
import ProfileScreen from './App/screens/profile/ProfileScreen.tsx';
import SettingsScreen from './App/screens/profile/SettingsScreen.tsx';
import OrganizationManagementScreen from './App/screens/profile/OrganizationManagmentScreen.tsx';
import JoinOrganizationScreen from './App/screens/profile/JoinOrganizationScreen.tsx';

// Root-Level Screens
import QuoteScreen from './App/screens/QuoteScreen.tsx';
import AskJesusScreen from './App/screens/AskJesusScreen.tsx';
import JournalScreen from './App/screens/JournalScreen.tsx';
import ConfessionalScreen from './App/screens/ConfessionalScreen.tsx';
import BuyTokensScreen from './App/screens/BuyTokensScreen.tsx';
import GiveBackScreen from './App/screens/GiveBackScreen.tsx';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | undefined>();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(
      async (firebaseUser: FirebaseAuthTypes.User | null) => {
        setUser(firebaseUser);

        if (firebaseUser) {
          const hasSeen = await SecureStore.getItemAsync(`hasSeenOnboarding-${firebaseUser.uid}`);
          setInitialRoute(hasSeen === 'true' ? 'Quote' : 'Onboarding');

          const { init } = await import('./App/utils/TokenManager.ts');
          init?.();
        }

        setCheckingAuth(false);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (checkingAuth || (!initialRoute && user)) {
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

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? initialRoute : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up' }} />
            <Stack.Screen name="OrganizationSignup" component={OrganizationSignupScreen} options={{ title: 'Create Organization' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Quote" component={QuoteScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SelectReligion" component={SelectReligionScreen} options={{ title: 'Select Religion' }} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="WWJD" component={AskJesusScreen} options={{ title: 'WWJD' }} />
            <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Quiet Journal' }} />
            <Stack.Screen name="Streak" component={StreakScreen} options={{ title: 'Grace Streak' }} />
            <Stack.Screen name="Challenge" component={ChallengeScreen} options={{ title: 'Daily Challenge' }} />
            <Stack.Screen name="Confessional" component={ConfessionalScreen} options={{ title: 'Confessional' }} />
            <Stack.Screen name="BuyTokens" component={BuyTokensScreen} options={{ title: 'Buy Tokens' }} />
            <Stack.Screen name="Upgrade" component={UpgradeScreen} options={{ title: 'Upgrade to WWJD+' }} />
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
    </NavigationContainer>
  );
}
