import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { theme } from '../components/theme/theme'
import { SCREENS } from './screens'

// Screens
import HomeScreen from '../screens/dashboard/HomeScreen'
import AskJesusScreen from '../screens/dashboard/AskJesusScreen'
import JournalScreen from '../screens/dashboard/JournalScreen'
import ChallengeScreen from '../screens/dashboard/ChallengeScreen'
import ConfessionalScreen from '../screens/dashboard/ConfessionalScreen'
import ProfileScreen from '../screens/profile/ProfileScreen'
import SettingsScreen from '../screens/profile/SettingsScreen'

const Tab = createBottomTabNavigator()

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.gray,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 0,
          paddingBottom: 4,
          height: 60
        },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case SCREENS.MAIN.HOME:
              return <Ionicons name="home-outline" size={size} color={color} />
            case SCREENS.MAIN.WWJD:
              return <MaterialCommunityIcons name="cross" size={size} color={color} />
            case SCREENS.MAIN.JOURNAL:
              return <Ionicons name="book-outline" size={size} color={color} />
            case SCREENS.MAIN.CHALLENGE:
              return <Ionicons name="flame-outline" size={size} color={color} />
            case SCREENS.MAIN.CONFESSIONAL:
              return <MaterialCommunityIcons name="account-heart-outline" size={size} color={color} />
            case SCREENS.MAIN.PROFILE:
              return <Ionicons name="person-circle-outline" size={size} color={color} />
            case SCREENS.MAIN.SETTINGS:
              return <Ionicons name="settings-outline" size={size} color={color} />
            default:
              return null
          }
        }
      })}
    >
      <Tab.Screen name={SCREENS.MAIN.HOME} component={HomeScreen} />
      <Tab.Screen name={SCREENS.MAIN.WWJD} component={AskJesusScreen} />
      <Tab.Screen name={SCREENS.MAIN.JOURNAL} component={JournalScreen} />
      <Tab.Screen name={SCREENS.MAIN.CHALLENGE} component={ChallengeScreen} />
      <Tab.Screen name={SCREENS.MAIN.CONFESSIONAL} component={ConfessionalScreen} />
      <Tab.Screen name={SCREENS.MAIN.PROFILE} component={ProfileScreen} />
      <Tab.Screen name={SCREENS.MAIN.SETTINGS} component={SettingsScreen} />
    </Tab.Navigator>
  )
}
