import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert } from "react-native";
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { signup } from "@/services/authService";
import { initializeProfile } from "@/services/userService";
import { seedUserProfile } from "@/utils/seedUserProfile";
import { checkIfUserIsNewAndRoute } from "@/services/onboardingService";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/components/theme/theme";
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { resetToLogin } from "@/navigation/navigationRef";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleSignup = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert(
        "Invalid Password",
        "Password must be at least 6 characters long.",
      );
      return;
    }
    const requestPayload = { email, password };
    console.log("➡️ signup payload", requestPayload);
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await signup(email, password);
      if (!result.localId) throw new Error("User creation failed.");

      await seedUserProfile(result.localId, { email });
      await initializeProfile(result.localId);
      await checkIfUserIsNewAndRoute();
    } catch (err: any) {
      console.warn("🚫 Signup Failed:", err?.response?.data?.error?.message);
      const fbMessage = err?.response?.data?.error?.message;
      const message = fbMessage || err.message;
      const friendly =
        fbMessage === "EMAIL_EXISTS" ? "Email already in use." : message;
      setErrorMsg(friendly);
      Alert.alert("Signup Failed", friendly);
    } finally {
      setLoading(false);
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
      }),
    [theme],
  );

  return (
    <ScreenContainer>
      <CustomText style={styles.title}>Create an Account</CustomText>

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

      {errorMsg ? (
        <CustomText style={{ color: theme.colors.danger }}>
          {errorMsg}
        </CustomText>
      ) : null}

      <Button title="Sign Up" onPress={handleSignup} loading={loading} />

      <CustomText style={styles.link} onPress={resetToLogin}>
        Already have an account? Log in
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

// styles created inside component so they update with theme
