// App.tsx (updated for login flow)
import React, { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebaseConfig'
import { syncSubscriptionStatus } from './utils/TokenManager'

import QuoteScreen from './screens/QuoteScreen'
import HomeScreen from './screens/HomeScreen'
import AskJesusScreen from './screens/AskJesusScreen'
import JournalScreen from './screens/JournalScreen'
import StreakScreen from './screens/StreakScreen'
import ChallengeScreen from './screens/ChallengeScreen'
import ConfessionalScreen from './screens/ConfessionalScreen'
import BuyTokensScreen from './screens/BuyTokensScreen'
import UpgradeScreen from './screens/UpgradeScreen'
import OnboardingScreen from './screens/OnboardingScreen'
import GiveBackScreen from './screens/GiveBackScreen'
import LoginScreen from './screens/LoginScreen'
import SignupScreen from './screens/SignupScreen'

import { theme } from './components/theme/theme'

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
        syncSubscriptionStatus()
      }
      setCheckingAuth(false)
    })
    return unsubscribe
  }, [])

  if (checkingAuth || !initialRoute && user) {
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
