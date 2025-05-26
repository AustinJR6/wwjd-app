import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './RootStackParamList.ts';
import LoginScreen from '../screens/auth/LoginScreen.tsx';
import SignupScreen from '../screens/auth/SignupScreen.tsx';
import OnboardingScreen from '../screens/auth/OnboardingScreen.tsx';
import OrganizationSignupScreen from '../screens/auth/OrganizationSignupScreen.tsx';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen
        name="OrganizationSignup"
        component={OrganizationSignupScreen as React.ComponentType<any>} // ✅ Type patch
      />
    </Stack.Navigator>
  );
}
