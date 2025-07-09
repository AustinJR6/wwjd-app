import React, { useState } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, TextInput, ActivityIndicator } from "react-native";
import * as SecureStore from "expo-secure-store";
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loadUserProfile, setCachedUserProfile, updateUserProfile } from "../../../utils/userProfile";

import { fetchUserProfile, completeOnboarding } from "../../services/userService";


import { createUserDoc } from "../../../firebaseRest";
import { getIdToken } from "@/utils/authUtils";
import type { UserProfile } from "../../../types/profile";
import { useUserStore } from "@/state/userStore";
import { useAuthStore } from "@/state/authStore";
import { SCREENS } from "@/navigation/screens";
import { useTheme } from "@/components/theme/theme";
import { Picker } from "@react-native-picker/picker";
import type { RootStackParamList } from "@/navigation/RootStackParamList";
import { useLookupLists } from "@/hooks/useLookupLists";

type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Onboarding"
>;

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user);
  const uidFromAuth = useAuthStore((state) => state.uid);
  const navigation = useNavigation<OnboardingScreenProps["navigation"]>();
  const theme = useTheme();
  const { regions, religions, loading: listsLoading } = useLookupLists();
  const [religion, setReligion] = useState(user?.religion ?? 'SpiritGuide');
  const [username, setUsername] = useState(
    user?.username ?? user?.displayName ?? ""
  );
  const [region, setRegion] = useState("");
  const [organization, setOrganization] = useState("");
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

    if (!religion) {
      setReligionError('Please select a spiritual lens.');
      return;
    } else {
      setReligionError('');
    }

    setSaving(true);
    console.log('💾 Submitting onboarding', { username, region, religion });
    try {
      if (uid) {
        const token = await getIdToken(true);
        const existing = await fetchUserProfile(uid);
        if (!existing) {
          await createUserDoc({
            uid,
            email: user?.email || '',
            displayName: username.trim(),
            username: username.trim(),
            region,
            religion,
            idToken: token || '',
          });
        } else {
          await updateUserProfile(
            {
              displayName: username.trim(),
              username: username.trim(),
              region,
              religion,
            },
            uid,
          );
        }
        const updated: UserProfile | null = await loadUserProfile(uid);
        setCachedUserProfile(updated as any);
        await completeOnboarding(uid);
        await SecureStore.setItemAsync(`hasSeenOnboarding-${uid}`, 'true');
        useUserStore.getState().updateUser({
          onboardingComplete: true,
          username: username.trim(),
          displayName: username.trim(),
          region,
          religion,
        });
        if (!updated?.region || !updated?.religion || !updated?.username || !updated?.email) {
          console.warn('⚠️ Missing required profile fields after onboarding:', updated);
        }
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' as keyof RootStackParamList }],
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
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
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

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
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

      <TextInput
        style={styles.input}
        placeholder="Organization (optional)"
        value={organization}
        onChangeText={setOrganization}
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
