import React, { useState, useEffect } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  completeOnboarding,
  updateUserFields,
} from "@/services/userService";
import { useUserStore } from "@/state/userStore";
import { useAuthStore } from "@/state/authStore";
import { SCREENS } from "@/navigation/screens";
import { useTheme } from "@/components/theme/theme";
import { Picker } from "@react-native-picker/picker";
import type { RootStackParamList } from "@/navigation/RootStackParamList";
import { queryCollection } from "@/services/firestoreService";

type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Onboarding"
>;

const religions = ["Christian", "Muslim", "Jewish", "Hindu", "Buddhist"];

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user);
  const uidFromAuth = useAuthStore((state) => state.uid);
  const navigation = useNavigation<OnboardingScreenProps["navigation"]>();
  const theme = useTheme();
  const [religion, setReligion] = useState(user?.religion ?? "Christian");
  const [username, setUsername] = useState(
    user?.username ?? user?.displayName ?? ""
  );
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<any[]>([]);
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await queryCollection('regions');
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setRegions(list);
        if (!region && list.length) setRegion(list[0].name);
      } catch (err) {
        console.warn('Failed to load regions', err);
      }
    };
    load();
  }, []);

  const handleContinue = async () => {
    const uid = user?.uid || uidFromAuth;
    if (!uid) {
      Alert.alert("Error", "User ID is missing.");
      return;
    }

    if (!username.trim() || !region.trim()) {
      Alert.alert("Missing Info", "Username and region are required.");
      return;
    }

    setLoading(true);
    try {
      if (uid) {
        await updateUserFields(uid, {
          religion,
          username,
          displayName: username,
          region,
          organizationId: organization || undefined,
          uid,
        });
        await completeOnboarding(uid);
        await SecureStore.setItemAsync(`hasSeenOnboarding-${uid}`, "true");
        useUserStore.getState().updateUser({
          onboardingComplete: true,
          username,
          displayName: username,
          region,
          religion,
        });

        navigation.reset({
          index: 0,
          routes: [{ name: SCREENS.MAIN.HOME as keyof RootStackParamList }],
        });
      }
    } catch (err: any) {
      Alert.alert(
        "Error completing onboarding",
        err.message || "An unknown error occurred.",
      );
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
          onValueChange={(val) => setRegion(val)}
          style={styles.picker}
        >
          {regions.map((r) => (
            <Picker.Item key={r.id || r.code} label={r.name} value={r.name} />
          ))}
        </Picker>
      </View>

      <CustomText style={styles.subtitle}>
        Choose your spiritual lens:
      </CustomText>

      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={religion}
          onValueChange={(itemValue) => setReligion(itemValue)}
          style={styles.picker}
        >
          {religions.map((r) => (
            <Picker.Item key={r} label={r} value={r} />
          ))}
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Organization (optional)"
        value={organization}
        onChangeText={setOrganization}
      />

      <Button title="Continue" onPress={handleContinue} loading={loading} />
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
