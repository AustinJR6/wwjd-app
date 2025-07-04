import React, { useState, useEffect } from "react";
import CustomText from "@/components/CustomText";
import { View, StyleSheet, Alert, TextInput } from "react-native";
import * as SecureStore from "expo-secure-store";
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { updateUserFields, completeOnboarding } from "@/services/userService";
import {
  saveUsernameAndProceed,
} from "@/services/onboardingService";
import { useUserStore } from "@/state/userStore";
import { useAuthStore } from "@/state/authStore";
import { SCREENS } from "@/navigation/screens";
import { useTheme } from "@/components/theme/theme";
import { Picker } from "@react-native-picker/picker";
import type { RootStackParamList } from "@/navigation/RootStackParamList";
import { queryCollection, getDocument } from "@/services/firestoreService";
import { fetchReligionList } from "../../../religionRest";

type OnboardingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Onboarding"
>;

const FALLBACK_RELIGION = { id: 'spiritual', name: 'Spiritual Guide' };

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user);
  const uidFromAuth = useAuthStore((state) => state.uid);
  const navigation = useNavigation<OnboardingScreenProps["navigation"]>();
  const theme = useTheme();
  const [religion, setReligion] = useState(user?.religion ?? "");
  const [religions, setReligions] = useState<any[]>([]);
  const [username, setUsername] = useState(
    user?.username ?? user?.displayName ?? ""
  );
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<any[]>([]);
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);
  const [religionError, setReligionError] = useState("");

  useEffect(() => {
    const load = async () => {
      console.log('➡️ fetching regions');
      try {
        const list = await queryCollection('regions');
        console.log(`✅ fetched ${list.length} regions`);
        if (!list.length) console.error('❌ Regions list was empty');
        list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setRegions(list);
      } catch (err) {
        console.error('Failed to load regions', err);
        setRegions([{ name: 'Unknown', code: 'UNKNOWN' }]);
      }

      console.log('➡️ fetching religions via REST');
      try {
        const rels = await fetchReligionList();
        console.log(`✅ fetched ${rels.length} religions`);
        if (!rels.length) console.error('❌ Religions list was empty');
        rels.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        setReligions(rels);
      } catch (err) {
        console.error('Failed to load religions', err);
        setReligions([FALLBACK_RELIGION]);
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

    setLoading(true);
    try {
      if (uid) {
        await saveUsernameAndProceed(username.trim());
        await updateUserFields(uid, {
          religion,
          region,
          organizationId: organization || undefined,
        });
        await completeOnboarding(uid);
        await SecureStore.setItemAsync(`hasSeenOnboarding-${uid}`, 'true');
        useUserStore.getState().updateUser({
          onboardingComplete: true,
          username: username.trim(),
          displayName: username.trim(),
          region,
          religion,
        });
        const check = await getDocument(`users/${uid}`);
        console.log('✅ profile after onboarding', {
          username: check?.username,
          region: check?.region,
          religion: check?.religion,
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
          <Picker.Item label="Select your region" value="" />
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
          <Picker.Item label="Select your spiritual lens" value="" />
          {religions.map((r) => (
            <Picker.Item key={r.id || r.name} label={r.name} value={r.id || r.name} />
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
