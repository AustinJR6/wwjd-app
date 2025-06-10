import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import './App/config/firebaseApp'; // ✅ Ensure Firebase is initialized first

const firebaseAuth = auth();

import { RootStackParamList } from './App/navigation/RootStackParamList';
import { theme } from './App/components/theme/theme';

// Auth Screens
import LoginScreen from './App/screens/auth/LoginScreen';
import SignupScreen from './App/screens/auth/SignupScreen';
import OnboardingScreen from './App/screens/auth/OnboardingScreen';
import SelectReligionScreen from './App/screens/auth/SelectReligionScreen';
import OrganizationSignupScreen from './App/screens/auth/OrganizationSignupScreen';

// Dashboard Screens
import HomeScreen from './App/screens/dashboard/HomeScreen';
import ChallengeScreen from './App/screens/dashboard/ChallengeScreen';
import StreakScreen from './App/screens/dashboard/StreakScreen';
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
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | undefined>();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        unsubscribe = firebaseAuth.onAuthStateChanged(
          async (firebaseUser: FirebaseAuthTypes.User | null) => {
            setUser(firebaseUser);

            if (firebaseUser) {
              const hasSeen = await SecureStore.getItemAsync(`hasSeenOnboarding-${firebaseUser.uid}`);
              setInitialRoute(hasSeen === 'true' ? 'Quote' : 'Onboarding');

              const { init } = await import('./App/utils/TokenManager');
              init?.();
            } else {
              setInitialRoute('Login');
            }

            setCheckingAuth(false);
          }
        );
      } catch (err) {
        console.error('❌ Auth load error in AppNavigator:', err);
        setCheckingAuth(false);
        setInitialRoute('Login');
      }
    };

    initialize();

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
            <Stack.Screen name="ReligionAI" component={ReligionAIScreen} options={{ title: 'Religion AI' }} />
            <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Quiet Journal' }} />
            <Stack.Screen name="Streak" component={StreakScreen} options={{ title: 'Grace Streak' }} />
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
    </NavigationContainer>
  );
}
