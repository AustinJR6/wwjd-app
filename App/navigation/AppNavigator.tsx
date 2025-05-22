import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth'; // ✅ Fix: Import User type

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import { theme } from '../components/theme/theme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [user, setUser] = useState<User | null>(null); // ✅ Fix: Add User type here
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: any;

    const initialize = async () => {
      try {
        const [{ auth }, { onAuthStateChanged }] = await Promise.all([
          import('../config/firebaseConfig'),
          import('firebase/auth')
        ]);

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          setUser(firebaseUser);

          if (firebaseUser) {
            const seen = await AsyncStorage.getItem(`hasSeenOnboarding-${firebaseUser.uid}`);
            setHasSeenOnboarding(seen === 'true');
          }

          setLoading(false);
        });
      } catch (err) {
        console.error('❌ Auth load error in AppNavigator:', err);
        setLoading(false);
      }
    };

    initialize();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !hasSeenOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
