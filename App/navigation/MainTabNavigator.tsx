import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from "@/components/theme/theme";

// Screens
import HomeScreen from "@/screens/dashboard/HomeScreen";
import ReligionAIScreen from "@/screens/ReligionAIScreen";
import JournalScreen from "@/screens/JournalScreen";
import ChallengeScreen from "@/screens/dashboard/ChallengeScreen";
import ConfessionalScreen from "@/screens/ConfessionalScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import SettingsScreen from "@/screens/profile/SettingsScreen";
import TriviaScreen from "@/screens/dashboard/TriviaScreen";
import LeaderboardScreen from "@/screens/dashboard/LeaderboardScreen";

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const theme = useTheme();
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
          height: 60,
        },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case 'Home':
              return <Ionicons name="home-outline" size={size} color={color} />;
            case 'ReligionAI':
              return <MaterialCommunityIcons name="cross" size={size} color={color} />;
            case 'Journal':
              return <Ionicons name="book-outline" size={size} color={color} />;
            case 'Challenge':
              return <Ionicons name="flame-outline" size={size} color={color} />;
            case 'Confessional':
              return <MaterialCommunityIcons name="account-heart-outline" size={size} color={color} />;
            case 'Profile':
              return <Ionicons name="person-circle-outline" size={size} color={color} />;
            case 'Settings':
              return <Ionicons name="settings-outline" size={size} color={color} />;
            case 'Trivia':
              return <MaterialCommunityIcons name="book-search-outline" size={size} color={color} />;
            case 'Leaderboards':
              return <Ionicons name="trophy-outline" size={size} color={color} />;
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen as React.ComponentType<any>} />
      <Tab.Screen name="ReligionAI" component={ReligionAIScreen as React.ComponentType<any>} />
      <Tab.Screen name="Journal" component={JournalScreen as React.ComponentType<any>} />
      <Tab.Screen name="Challenge" component={ChallengeScreen as React.ComponentType<any>} />
      <Tab.Screen name="Confessional" component={ConfessionalScreen as React.ComponentType<any>} />
      <Tab.Screen name="Trivia" component={TriviaScreen as React.ComponentType<any>} />
      <Tab.Screen name="Leaderboards" component={LeaderboardScreen as React.ComponentType<any>} />
      <Tab.Screen name="Profile" component={ProfileScreen as React.ComponentType<any>} />
      <Tab.Screen name="Settings" component={SettingsScreen as React.ComponentType<any>} />
    </Tab.Navigator>
  );
}

