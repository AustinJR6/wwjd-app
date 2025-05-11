// App/navigation/AppNavigator.tsx
import React, { useState, useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import AuthNavigator from './AuthNavigator'
import MainTabNavigator from './MainTabNavigator'
import OnboardingScreen from '../screens/auth/OnboardingScreen'
import useAuth from '../hooks/useAuth'
import { theme } from '../components/theme/theme'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)

  // When auth state changes, check if they've done onboarding
  useEffect(() => {
    async function checkOnboarding() {
      if (user) {
        const seen = await AsyncStorage.getItem(`hasSeenOnboarding-${user.uid}`)
        setHasSeenOnboarding(seen === 'true')
      }
      setLoading(false)
    }
    checkOnboarding()
  }, [user])

  // Show a spinner while we're waiting on auth + onboarding
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Not logged in
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !hasSeenOnboarding ? (
          // First login, show onboarding
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Authenticated & onboarded
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
