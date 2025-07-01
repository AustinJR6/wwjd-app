import React, { useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, TextInput } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { completeOnboarding, updateUserFields, ensureUserDocExists, loadUser } from "@/services/userService";
import { useUserStore } from "@/state/userStore";
import { SCREENS } from "@/navigation/screens";
import { useTheme } from "@/components/theme/theme";
import { Picker } from '@react-native-picker/picker';
import type { RootStackParamList } from "@/navigation/RootStackParamList";

type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const religions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist'];

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user);
  const navigation = useNavigation<OnboardingScreenProps['navigation']>();
  const theme = useTheme();
  const [religion, setReligion] = useState(user?.religion ?? 'Christian');
  const [username, setUsername] = useState(user?.displayName ?? '');
  const [region, setRegion] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(false);


  const handleContinue = async () => {
    if (!user) {
      Alert.alert('Session expired — please log in again.');
      navigation.replace('Login');
      return;
    }

    if (!username.trim() || !region.trim()) {
      Alert.alert('Missing Info', 'Username and region are required.');
      return;
    }

    setLoading(true);
    try {
      if (user.uid) {
        await updateUserFields(user.uid, {
          religion,
          displayName: username,
          region,
          organizationId: organization || undefined,
        });
        await completeOnboarding(user.uid);
        await SecureStore.setItemAsync(`hasSeenOnboarding-${user.uid}`, 'true');

        navigation.reset({
          index: 0,
          routes: [{ name: SCREENS.MAIN.HOME as keyof RootStackParamList }],

        });
      } else {
        Alert.alert('Error', 'User ID is missing.');
      }
    } catch (err: any) {
      Alert.alert('Error completing onboarding', err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 10,
          textAlign: 'center',
        },
        subtitle: {
          fontSize: 16,
          color: theme.colors.fadedText,
          marginBottom: 20,
          textAlign: 'center',
        },
        pickerWrapper: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          marginBottom: 20,
          overflow: 'hidden',
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
          textAlign: 'center',
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

      <TextInput
        style={styles.input}
        placeholder="Region"
        value={region}
        onChangeText={setRegion}
      />

      <CustomText style={styles.subtitle}>Choose your spiritual lens:</CustomText>

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
      <CustomText style={styles.link} onPress={() => navigation.replace('Login')}>
        Already have an account? Log in
      </CustomText>
    </ScreenContainer>
  );
}

// styles moved inside component to react to theme

