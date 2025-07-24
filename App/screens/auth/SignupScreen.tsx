import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { StyleSheet, Alert, ScrollView } from "react-native";
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { signup } from "@/services/authService";
import { updateUserProfile } from "@/utils/userProfile";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/components/theme/theme";
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { resetToLogin } from "@/navigation/navigationRef";
import { SCREENS } from "@/navigation/screens";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();

  const handleSignup = async () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      console.log('Validation failed: invalid email');
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!password || password.length < 6) {
      console.log('Validation failed: weak password');
      Alert.alert(
        "Invalid Password",
        "Password must be at least 6 characters long.",
      );
      return;
    }
    if (!username.trim()) {
      console.log('Validation failed: username required');
      Alert.alert("Missing Info", "Username is required.");
      return;
    }
    const requestPayload = { email, password };
    console.log("➡️ signup payload", requestPayload);
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await signup(email, password);
      if (!result.localId) throw new Error("User creation failed.");

      await updateUserProfile({ username: username.trim(), displayName: username.trim() }, result.localId);

      navigation.navigate(SCREENS.AUTH.PROFILE_COMPLETION as any);
    } catch (err: any) {
      console.warn(
        "🚫 Signup Failed:",
        err?.response?.data?.error?.message || err,
      );
      console.error("Signup Process Error:", err);
      const data = err?.response?.data;
      let errMsg = err.message;
      errMsg = data?.error?.message || errMsg;
      const code = err.code || data?.error?.status || data?.error?.message;
      let friendly = errMsg;
      switch (code) {
        case "EMAIL_EXISTS":
          friendly = "Email already in use.";
          navigation.navigate('Login');
          break;
        case "INVALID_EMAIL":
          friendly = "Invalid email address.";
          break;
        case "WEAK_PASSWORD":
          friendly = "Password should be at least 6 characters.";
          break;
        case "already-exists":
          friendly = "This username is already taken.";
          break;
        case "invalid-argument":
          friendly = err.message || "Invalid information provided.";
          break;
        case "permission-denied":
        case "unauthenticated":
          friendly = "Please sign in again.";
          break;
        case "internal":
          friendly = "Server error. Please try again.";
          break;
        default:
          if (code) friendly = errMsg;
      }
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
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
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

        <TextField
          label="Username *"
          value={username}
          onChangeText={setUsername}
          placeholder="johndoe"
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
      </ScrollView>
    </ScreenContainer>
  );
}

// styles created inside component so they update with theme
