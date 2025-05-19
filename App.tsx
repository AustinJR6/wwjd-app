import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Auth Screens
import LoginScreen from './App/screens/auth/LoginScreen';
import SignupScreen from './App/screens/auth/SignupScreen';
import OnboardingScreen from './App/screens/auth/OnboardingScreen';
import SelectReligionScreen from './App/screens/auth/SelectReligionScreen';
import OrganizationSignupScreen from './App/screens/auth/OrganizationSignupScreen'

// Dashboard Screens
import HomeScreen from './App/screens/dashboard/HomeScreen';
import ChallengeScreen from './App/screens/dashboard/ChallengeScreen';
import StreakScreen from './App/screens/dashboard/StreakScreen';
import UpgradeScreen from './App/screens/dashboard/UpgradeScreen';
import LeaderboardsScreen from './App/screens/LeaderboardsScreen';

// Profile Screens
import ProfileScreen from './App/screens/profile/ProfileScreen';
import SettingsScreen from './App/screens/profile/SettingsScreen';
import OrganizationManagementScreen from './App/screens/profile/OrganizationManagementScreen';
import JoinOrganizationScreen from './App/screens/profile/JoinOrganizationScreen';

// Root-Level Screens
import QuoteScreen from './App/screens/QuoteScreen';
import AskJesusScreen from './App/screens/AskJesusScreen';
import JournalScreen from './App/screens/JournalScreen';
import ConfessionalScreen from './App/screens/ConfessionalScreen';
import BuyTokensScreen from './App/screens/BuyTokensScreen';
import GiveBackScreen from './App/screens/GiveBackScreen';
import TriviaScreen from './App/screens/TriviaScreen';
import SubmitProofScreen from './App/screens/SubmitProofScreen';

import { theme } from './App/components/theme/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let unsubscribe: any;

    const bindAuth = async () => {
      try {
        const [{ auth }, { onAuthStateChanged }] = await Promise.all([
          import('./App/config/firebaseConfig'),
          import('firebase/auth'),
        ]);

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          setUser(firebaseUser);

          if (firebaseUser) {
            const hasSeen = await AsyncStorage.getItem(`hasSeenOnboarding-${firebaseUser.uid}`);
            setInitialRoute(hasSeen === 'true' ? 'Quote' : 'Onboarding');

            const TokenManager = await import('./App/utils/TokenManager');
            if (TokenManager?.default?.init) {
              TokenManager.default.init();
            }
          }

          setCheckingAuth(false);
        });
      } catch (err) {
        console.error('❌ Error during auth binding:', err);
        setCheckingAuth(false);
      }
    };

    const timeout = setTimeout(bindAuth, 0);

    return () => {
      clearTimeout(timeout);
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
