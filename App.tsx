import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import * as Sentry from '@sentry/react-native';
import ErrorBoundary from "./App/components/common/ErrorBoundary";
import { useFonts, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { Merriweather_400Regular } from "@expo-google-fonts/merriweather";
import * as SecureStore from 'expo-secure-store';
import { NavigationContainer } from "@react-navigation/native";
import { navigationRef } from "./App/navigation/navigationRef";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/state/authStore";
import { initAuthState } from "./App/services/authService";
import StartupAnimation from "./App/components/common/StartupAnimation";
import Constants from "expo-constants";

import { RootStackParamList } from "./App/navigation/RootStackParamList";
import { useTheme } from "./App/components/theme/theme";

// Auth Screens
import LoginScreen from "./App/screens/auth/LoginScreen";
import SignupScreen from "./App/screens/auth/SignupScreen";
import WelcomeScreen from "./App/screens/auth/WelcomeScreen";
import ForgotPasswordScreen from "./App/screens/auth/ForgotPasswordScreen";
import ForgotUsernameScreen from "./App/screens/auth/ForgotUsernameScreen";
import OnboardingScreen from "./App/screens/auth/OnboardingScreen";
import SelectReligionScreen from "./App/screens/auth/SelectReligionScreen";

const isExpoGo = Constants.appOwnership === "expo";
import OrganizationSignupScreen from "./App/screens/auth/OrganizationSignupScreen";

// Dashboard Screens
import HomeScreen from "./App/screens/dashboard/HomeScreen";
import ChallengeScreen from "./App/screens/dashboard/ChallengeScreen";
import UpgradeScreen from "./App/screens/dashboard/UpgradeScreen";
import LeaderboardsScreen from "./App/screens/dashboard/LeaderboardScreen";
import TriviaScreen from "./App/screens/dashboard/TriviaScreen";
import SubmitProofScreen from "./App/screens/dashboard/SubmitProofScreen";

// Profile Screens
import ProfileScreen from "./App/screens/profile/ProfileScreen";
import SettingsScreen from "./App/screens/profile/SettingsScreen";
import OrganizationManagementScreen from "./App/screens/profile/OrganizationManagmentScreen";
import JoinOrganizationScreen from "./App/screens/profile/JoinOrganizationScreen";
import ChangePasswordScreen from "./App/screens/profile/ChangePasswordScreen";

// Root-Level Screens
import QuoteScreen from "./App/screens/QuoteScreen";
import ReligionAIScreen from "./App/screens/ReligionAIScreen";
import JournalScreen from "./App/screens/JournalScreen";
import ConfessionalScreen from "./App/screens/ConfessionalScreen";
import BuyTokensScreen from "./App/screens/BuyTokensScreen";
import GiveBackScreen from "./App/screens/GiveBackScreen";

Sentry.init({
  dsn: 'YOUR_PUBLIC_DSN_HERE',
  tracesSampleRate: 1.0,
  enableInExpoDevelopment: true,
  debug: __DEV__,
});

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const { user } = useUser();
  const theme = useTheme();
  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Merriweather_400Regular,
  });
  const [initialRoute, setInitialRoute] = useState<
    keyof RootStackParamList | undefined
  >();
  const { authReady } = useAuth();
  const [showAnim, setShowAnim] = useState(true);

  useEffect(() => {
    if (isExpoGo) {
      console.warn(
        "⚠️ Running in Expo Go. Push notifications and Firebase Auth may not work as expected.",
      );
    }
  }, []);


  useEffect(() => {
    if (fontsLoaded) {
      console.log("✅ Fonts loaded");
    }
  }, [fontsLoaded]);

  useEffect(() => {
    initAuthState();
  }, []);

  // Fallback to avoid indefinite spinner during testing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().authReady) {
        console.warn("⏰ authReady fallback");
        useAuthStore.getState().setAuthReady(true);
      }
      if (!initialRoute) {
        console.warn("⏰ initialRoute fallback -> Login");
        setInitialRoute("Login");
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [initialRoute]);

  useEffect(() => {
    if (user) {
      console.log("🙋 User state updated:", user.uid);
      (async () => {
        const seen = await SecureStore.getItemAsync(
          `hasSeenOnboarding-${user.uid}`,
        );
        setInitialRoute(seen === 'true' ? 'Home' : 'Onboarding');
      })();
    } else if (authReady) {
      setInitialRoute('Login');
    }
  }, [user, authReady]);

  if (!fontsLoaded || !authReady || (!initialRoute && user)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  console.log(
    "🚀 Rendering navigator with initial route",
    user ? initialRoute : "Login",
  );
  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={user ? initialRoute : "Login"}
          screenOptions={{
            headerStyle: { backgroundColor: theme.colors.background },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: "bold",
              fontSize: 20,
              fontFamily: theme.fonts.title,
            },
          }}
        >
          {!user ? (
            <>
              <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: "Login" }}
              />
              <Stack.Screen
                name="Signup"
                component={SignupScreen}
                options={{ title: "Sign Up" }}
              />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{ title: "Reset Password" }}
              />
              <Stack.Screen
                name="ForgotUsername"
                component={ForgotUsernameScreen}
                options={{ title: "Find Email" }}
              />
              <Stack.Screen
                name="OrganizationSignup"
                component={OrganizationSignupScreen}
                options={{ title: "Create Organization" }}
              />
              {/* Onboarding needs to be accessible immediately after login */}
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ headerShown: false }}
              />
            </>
          ) : (
            <>
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="Quote"
                component={QuoteScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="SelectReligion"
                component={SelectReligionScreen}
                options={{ title: "Select Religion" }}
              />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen
                name="ReligionAI"
                component={ReligionAIScreen}
                options={{ title: "Religion AI" }}
              />
              <Stack.Screen
                name="Journal"
                component={JournalScreen}
                options={{ title: "Quiet Journal" }}
              />
              <Stack.Screen
                name="Challenge"
                component={ChallengeScreen}
                options={{ title: "Daily Challenge" }}
              />
              <Stack.Screen
                name="Confessional"
                component={ConfessionalScreen}
                options={{ title: "Confessional" }}
              />
              <Stack.Screen
                name="BuyTokens"
                component={BuyTokensScreen}
                options={{ title: "Buy Tokens" }}
              />
              <Stack.Screen
                name="Upgrade"
                component={UpgradeScreen}
                options={{ title: "Upgrade to OneVine+" }}
              />
              <Stack.Screen
                name="GiveBack"
                component={GiveBackScreen}
                options={{ title: "Give Back" }}
              />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{ title: "Change Password" }}
              />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen
                name="Trivia"
                component={TriviaScreen}
                options={{ title: "Trivia Challenge" }}
              />
              <Stack.Screen
                name="Leaderboards"
                component={LeaderboardsScreen}
                options={{ title: "Leaderboards" }}
              />
              <Stack.Screen
                name="SubmitProof"
                component={SubmitProofScreen}
                options={{ title: "Submit Proof" }}
              />
              <Stack.Screen
                name="OrganizationManagement"
                component={OrganizationManagementScreen}
                options={{ title: "Manage Organization" }}
              />
              <Stack.Screen
                name="JoinOrganization"
                component={JoinOrganizationScreen}
                options={{ title: "Join Organization" }}
              />
            </>
          )}
        </Stack.Navigator>
        {showAnim && <StartupAnimation onDone={() => setShowAnim(false)} />}
      </NavigationContainer>
    </ErrorBoundary>
  );
}
