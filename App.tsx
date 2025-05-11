// App.tsx
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { onAuthStateChanged } from 'firebase/auth'

import { auth } from './App/config/firebaseConfig'
import TokenManager from './App/utils/TokenManager'

// Auth Screens
import LoginScreen from './App/screens/auth/LoginScreen'
import SignupScreen from './App/screens/auth/SignupScreen'
import OnboardingScreen from './App/screens/auth/OnboardingScreen'

// Dashboard Screens
import HomeScreen from './App/screens/dashboard/HomeScreen'
import ChallengeScreen from './App/screens/dashboard/ChallengeScreen'
import StreakScreen from './App/screens/dashboard/StreakScreen'

// Profile Screens
import ProfileScreen from './App/screens/profile/ProfileScreen'
import SettingsScreen from './App/screens/profile/SettingsScreen'

// Root-Level Screens
import QuoteScreen from './App/screens/QuoteScreen'
import AskJesusScreen from './App/screens/AskJesusScreen'
import JournalScreen from './App/screens/JournalScreen'
import ConfessionalScreen from './App/screens/ConfessionalScreen'
import BuyTokensScreen from './App/screens/BuyTokensScreen'
import UpgradeScreen from './App/screens/dashboard/UpgradeScreen'
import GiveBackScreen from './App/screens/GiveBackScreen'

import { theme } from './App/components/theme/theme'

const Stack = createNativeStackNavigator()

export default function App() {
  const [user, setUser] = useState(null)
  const [initialRoute, setInitialRoute] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      if (user) {
        const hasSeen = await AsyncStorage.getItem(`hasSeenOnboarding-${user.uid}`)
        setInitialRoute(hasSeen === 'true' ? 'Quote' : 'Onboarding')
        TokenManager.init()
      }
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  if (checkingAuth || (!initialRoute && user)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? initialRoute : 'Login'}
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: 'bold', fontSize: 20 }
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Quote" component={QuoteScreen} options={{ headerShown: false }} />
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
