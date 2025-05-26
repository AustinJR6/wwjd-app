import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from "@/components/common/Button";
import { useNavigation, CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { completeOnboarding, updateUserFields } from "@/services/userService";
import { useUserStore } from "@/state/userStore";
import { SCREENS } from "@/navigation/screens";
import { theme } from "@/components/theme/theme";
import { Picker } from '@react-native-picker/picker';
import type { RootStackParamList } from "@/navigation/RootStackParamList";

type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const religions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist'];

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user);
  const navigation = useNavigation<OnboardingScreenProps['navigation']>();
  const [religion, setReligion] = useState(user?.religion ?? 'Christian');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found. Please log in again.');
      return;
    }

    setLoading(true);
    try {
      if (user.uid) {
        await updateUserFields(user.uid, { religion });
        await completeOnboarding(user.uid);

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

  return (
    <ScreenContainer>
      <Text style={styles.title}>Welcome to OneVine 🌿</Text>
      <Text style={styles.subtitle}>Choose your spiritual lens:</Text>

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

      <Button title="Continue" onPress={handleContinue} loading={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});

