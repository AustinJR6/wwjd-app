import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { showGracefulError } from "@/utils/gracefulError";
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { login, resetPassword } from "@/services/authService";
import { ensureUserDocExists, fetchUserProfile } from "@/services/userService";
import { useUserStore } from "@/state/userStore";
import { useAuthStore } from "@/state/authStore";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/components/theme/theme";
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { SCREENS } from "@/navigation/screens";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<NavigationProp>();
  const setUid = useAuthStore.getState().setUid;
  const theme = useTheme();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.localId) {
        setUid(result.localId);
        const isNew = await ensureUserDocExists(result.localId, result.email);
        const profile = await fetchUserProfile(result.localId);
        if (profile) {
          useUserStore.getState().setUser({
            uid: profile.uid,
            email: profile.email,
            displayName: profile.displayName ?? "",
            isSubscribed: profile.isSubscribed,
            religion: profile.religion,
            region: profile.region ?? "",
            organizationId: profile.organizationId,
            onboardingComplete: profile.onboardingComplete,
            tokens: 0,
          });
        }
        const profileValid = profile?.uid === result.localId;
        const needsOnboarding = isNew || !profileValid;
        console.log(
          "🧭 Post-login route",
          needsOnboarding ? SCREENS.AUTH.ONBOARDING : SCREENS.MAIN.HOME,
        );
        navigation.reset({
          index: 0,
          routes: [
            {
              name: (needsOnboarding
                ? SCREENS.AUTH.ONBOARDING
                : SCREENS.MAIN.HOME) as keyof RootStackParamList,
            },
          ],
        });
      }
    } catch (err: any) {
      showGracefulError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Password Reset", "Please enter your email first.");
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert(
        "Password Reset",
        "If this email is registered, a reset link has been sent.",
      );
    } catch (err: any) {
      showGracefulError(err.message);
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.colors.text,
          marginBottom: 20,
        },
        link: {
          marginTop: 20,
          color: theme.colors.primary,
          textAlign: "center",
        },
        spinner: {
          marginBottom: 16,
        },
      }),
    [theme],
  );

  return (
    <ScreenContainer>
      {loading && (
        <ActivityIndicator
          style={styles.spinner}
          size="large"
          color={theme.colors.primary}
        />
      )}
      <CustomText style={styles.title}>Welcome Back</CustomText>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••"
        secureTextEntry
      />

      <Button title="Log In" onPress={handleLogin} loading={loading} />
      <CustomText style={styles.link} onPress={handleForgotPassword}>
        Forgot Password?
      </CustomText>

      <CustomText
        style={styles.link}
        onPress={() => navigation.navigate("Signup")}
      >
        Don’t have an account? Sign up
      </CustomText>

      <CustomText
        style={styles.link}
        onPress={() => navigation.navigate("OrganizationSignup")}
      >
        Want to register your organization? Click here
      </CustomText>
    </ScreenContainer>
  );
}

// styles created inside component to update with theme
