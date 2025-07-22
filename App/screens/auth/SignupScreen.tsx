import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import ScreenContainer from "@/components/theme/ScreenContainer";
import TextField from "@/components/TextField";
import Button from "@/components/common/Button";
import { signup } from "@/services/authService";
import { API_URL } from "@/config/firebaseApp";
import { getAuthHeaders } from "@/utils/authUtils";
import { loadUserProfile, CURRENT_PROFILE_SCHEMA } from "@/utils/userProfile";
import { useUserProfileStore } from "@/state/userProfile";
import { DEFAULT_RELIGION } from "@/config/constants";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "@/components/theme/theme";
import { RootStackParamList } from "@/navigation/RootStackParamList";
import { resetToLogin } from "@/navigation/navigationRef";
import { SCREENS } from "@/navigation/screens";
import { Picker } from "@react-native-picker/picker";
import { useLookupLists } from "@/hooks/useLookupLists";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [region, setRegion] = useState("");
  const [religion, setReligion] = useState("");
  const [organization, setOrganization] = useState("");
  const [religionError, setReligionError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigation = useNavigation<NavigationProp>();
  const theme = useTheme();
  const { regions, religions, loading: listsLoading } = useLookupLists();

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
    if (!username.trim()) {
      Alert.alert("Missing Info", "Username is required.");
      return;
    }
    if (!preferredName.trim()) {
      Alert.alert("Missing Info", "Preferred name is required.");
      return;
    }
    if (!pronouns.trim()) {
      Alert.alert("Missing Info", "Pronouns are required.");
      return;
    }
    if (!avatarURL.trim()) {
      Alert.alert("Missing Info", "Avatar URL is required.");
      return;
    }
    if (!religion) {
      setReligionError("Please select a spiritual lens.");
      return;
    } else {
      setReligionError("");
    }

    const requestPayload = { email, password };
    console.log("➡️ signup payload", requestPayload);
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await signup(email, password);
      if (!result.localId) throw new Error("User creation failed.");

      const uid = result.localId;
      const headers = await getAuthHeaders();
      const now = new Date().toISOString();
      const profile = {
        uid,
        email: email.trim(),
        emailVerified: false,
        displayName: username.trim(),
        username: username.trim(),
        region: region || "",
        createdAt: now,
        lastActive: now,
        lastFreeAsk: now,
        lastFreeSkip: now,
        onboardingComplete: true,
        religion: religion || DEFAULT_RELIGION,
        tokens: 0,
        skipTokensUsed: 0,
        individualPoints: 0,
        isSubscribed: false,
        nightModeEnabled: false,
        preferredName: preferredName.trim(),
        pronouns: pronouns.trim(),
        avatarURL: avatarURL.trim(),
        profileComplete: true,
        profileSchemaVersion: CURRENT_PROFILE_SCHEMA,
        challengeStreak: { count: 0, lastCompletedDate: null },
        dailyChallengeCount: 0,
        dailySkipCount: 0,
        lastChallengeLoadDate: null,
        lastSkipDate: null,
        organization: organization || null,
        organizationId: null,
        religionPrefix: "",
      };

      const res = await fetch(`${API_URL}/completeSignupAndProfile`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: { uid, profile } }),
      });
      if (!res.ok) {
        let errMsg = `Status ${res.status}`;
        try {
          const data = await res.json();
          errMsg = data?.error?.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const createdProfile = await loadUserProfile(uid);
      if (createdProfile) {
        useUserProfileStore.getState().setUserProfile(createdProfile as any);
      }
      navigation.reset({ index: 0, routes: [{ name: SCREENS.MAIN.HOME }] });
    } catch (err: any) {
      console.warn("🚫 Signup Failed:", err?.response?.data?.error?.message);
      const code = err?.response?.data?.error?.message;
      let friendly = err.message;
      switch (code) {
        case "EMAIL_EXISTS":
          friendly = "Email already in use.";
          break;
        case "INVALID_EMAIL":
          friendly = "Invalid email address.";
          break;
        case "WEAK_PASSWORD":
          friendly = "Password should be at least 6 characters.";
          break;
        default:
          if (code) friendly = code;
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
        subtitle: {
          fontSize: 16,
          color: theme.colors.fadedText,
          marginBottom: 20,
          textAlign: "center",
        },
        pickerWrapper: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          marginBottom: 20,
          overflow: "hidden",
        },
        picker: {
          height: 50,
          color: theme.colors.text,
          backgroundColor: theme.colors.inputBackground || theme.colors.surface,
        },
        link: {
          marginTop: 20,
          color: theme.colors.primary,
          textAlign: "center",
        },
      }),
    [theme],
  );

  if (listsLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

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

        <TextField
          label="Preferred Name *"
          value={preferredName}
          onChangeText={setPreferredName}
          placeholder="John"
        />

        <TextField
          label="Pronouns *"
          value={pronouns}
          onChangeText={setPronouns}
          placeholder="he/him"
        />

        <TextField
          label="Avatar URL *"
          value={avatarURL}
          onChangeText={setAvatarURL}
          placeholder="https://example.com/avatar.jpg"
        />

        <CustomText style={styles.subtitle}>Select your region:</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={region}
            onValueChange={(val) => setRegion(val)}
            style={styles.picker}
          >
            <Picker.Item label="Select your region" value="" />
            {regions.map((r) => (
              <Picker.Item key={r.id} label={r.name} value={r.name} />
            ))}
          </Picker>
        </View>

        <CustomText style={styles.subtitle}>Choose your spiritual lens:</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={religion}
            onValueChange={(val) => setReligion(val)}
            style={styles.picker}
          >
            <Picker.Item label="Select your spiritual lens" value="" />
            {religions.map((r) => (
              <Picker.Item key={r.id} label={r.id} value={r.id} />
            ))}
          </Picker>
        </View>
        {religionError ? (
          <CustomText style={{ color: 'red', marginBottom: 8 }}>
            {religionError}
          </CustomText>
        ) : null}

        <TextField
          label="Organization"
          value={organization}
          onChangeText={setOrganization}
          placeholder="Optional"
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
