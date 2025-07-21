import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import TextField from "@/components/TextField";
import * as SecureStore from "expo-secure-store";
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setCachedUserProfile, updateUserProfile } from "@/utils/userProfile";

import { getIdToken } from "@/utils/authUtils";
import { DEFAULT_RELIGION } from "@/config/constants";
import type { UserProfile } from "../../../types";
import { useUserProfileStore } from "@/state/userProfile";
import { useAuthStore } from "@/state/authStore";
import { SCREENS } from "@/navigation/screens";
import { useTheme } from "@/components/theme/theme";
import { Picker } from "@react-native-picker/picker";
import type { RootStackParamList } from "@/navigation/RootStackParamList";
import { useLookupLists } from "@/hooks/useLookupLists";
import { ensureUserProfile } from "@/services/userValidationService";

type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Onboarding"
>;

export default function OnboardingScreen() {
  const user = useUserProfileStore((state: any) => state.profile);
  const uidFromAuth = useAuthStore((state) => state.uid);
  const navigation = useNavigation<OnboardingScreenProps["navigation"]>();
  const theme = useTheme();
  const { regions, religions, loading: listsLoading } = useLookupLists();
  const [religion, setReligion] = useState(user?.religion ?? "SpiritGuide");
  const [username, setUsername] = useState(
    user?.username ?? user?.displayName ?? ""
  );
  const [region, setRegion] = useState("");
  const [organization, setOrganization] = useState("");
  const [preferredNameInput, setPreferredNameInput] = useState(
    user?.preferredName ?? ""
  );
  const [pronounsInput, setPronounsInput] = useState(user?.pronouns ?? "");
  const [avatarURLInput, setAvatarURLInput] = useState(user?.avatarURL ?? "");
  const [saving, setSaving] = useState(false);
  const [religionError, setReligionError] = useState("");

  React.useEffect(() => {
    console.log('📋 Available religions', religions);
  }, [religions]);

  const handleContinue = async () => {
    const uid = user?.uid || uidFromAuth;
    if (!uid) {
      Alert.alert("Error", "User ID is missing.");
      return;
    }

    if (!username.trim()) {
      Alert.alert('Missing Info', 'Username is required.');
      return;
    }

    if (!preferredNameInput.trim()) {
      Alert.alert('Missing Info', 'Preferred name is required.');
      return;
    }

    if (!pronounsInput.trim()) {
      Alert.alert('Missing Info', 'Pronouns are required.');
      return;
    }

    if (!avatarURLInput.trim()) {
      Alert.alert('Missing Info', 'Avatar URL is required.');
      return;
    }

    if (!religion) {
      setReligionError('Please select a spiritual lens.');
      return;
    } else {
      setReligionError('');
    }

    setSaving(true);
    console.log('💾 Submitting onboarding', { username, region, religion, organization });
    try {
      if (uid) {
        await getIdToken(true); // ensure token valid
        // Always reload the full profile after creation/update
        await updateUserProfile(
          {
            displayName: username.trim(),
            username: username.trim(),
            region: region || '',
            religion: religion || DEFAULT_RELIGION,
            onboardingComplete: true,
            challengeStreak: { count: 0, lastCompletedDate: null },
            dailyChallengeCount: 0,
            dailySkipCount: 0,
            lastChallengeLoadDate: null,
            lastSkipDate: null,
            preferredName: preferredNameInput.trim(),
            pronouns: pronounsInput.trim(),
            avatarURL: avatarURLInput.trim(),
            organization: organization || null,
            profileComplete: true,
          },
          uid,
        );

        console.log('[✅ Onboarding Complete] User profile updated and marked complete');

        const ensured = await ensureUserProfile(uid);
        if (!ensured?.profileComplete) {
          throw new Error('Profile missing required fields');
        }

        setCachedUserProfile(ensured as any);
        await SecureStore.setItemAsync(`hasSeenOnboarding-${uid}`, 'true');
        useUserProfileStore.getState().setUserProfile(ensured as any);

        navigation.reset({
          index: 0,
          routes: [{ name: SCREENS.MAIN.HOME }],
        });
      }
    } catch (err: any) {
      Alert.alert(
        "Error completing onboarding",
        err.message || "An unknown error occurred.",
      );
    } finally {
      setSaving(false);
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 24,
          fontWeight: "700",
          color: theme.colors.text,
          marginBottom: 10,
          textAlign: "center",
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
          color: theme.colors.primary,
          marginTop: 16,
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
      <CustomText style={styles.title}>Welcome to OneVine 🌿</CustomText>
      <CustomText style={styles.subtitle}>Tell us about yourself:</CustomText>

      <TextField
        label="Username *"
        value={username}
        onChangeText={setUsername}
        placeholder="johndoe"
      />

      <TextField
        label="Preferred Name *"
        value={preferredNameInput}
        onChangeText={setPreferredNameInput}
        placeholder="John"
      />

      <TextField
        label="Pronouns *"
        value={pronounsInput}
        onChangeText={setPronounsInput}
        placeholder="he/him"
      />

      <TextField
        label="Avatar URL *"
        value={avatarURLInput}
        onChangeText={setAvatarURLInput}
        placeholder="https://example.com/avatar.jpg"
      />

      <CustomText style={styles.subtitle}>Select your region:</CustomText>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={region}
          onValueChange={(val) => {
            console.log('📍 Region selected', val);
            setRegion(val);
          }}
          style={styles.picker}
        >
          <Picker.Item label="Select your region" value="" />
          {regions.map((r) => (
            <Picker.Item key={r.id} label={r.name} value={r.name} />
          ))}
        </Picker>
      </View>

      <CustomText style={styles.subtitle}>
        Choose your spiritual lens:
      </CustomText>

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={religion}
          onValueChange={(itemValue) => {
            console.log('🙏 Religion selected', itemValue);
            setReligion(itemValue);
          }}
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

      <Button title="Continue" onPress={handleContinue} loading={saving} />
      <CustomText
        style={styles.link}
        onPress={() => navigation.navigate("Login")}
      >
        Already have an account? Log in
      </CustomText>
    </ScreenContainer>
  );
}

// styles moved inside component to react to theme
