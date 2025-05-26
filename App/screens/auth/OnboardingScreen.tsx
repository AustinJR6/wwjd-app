import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '../../components/theme/ScreenContainer.tsx';
import Button from '../../components/common/Button.tsx';
import { useNavigation, CommonActions, NavigationProp } from '@react-navigation/native';
import { completeOnboarding, updateUserFields } from '../../services/userService.ts';
import { useUserStore } from '../../state/userStore.ts';
import { SCREENS } from '../../navigation/screens.ts';
import { theme } from '../../components/theme/theme.ts';
import { Picker } from '@react-native-picker/picker';
import type { RootStackParamList } from '../../navigation/RootStackParamList.ts'; // ✅ Typed navigation

const religions = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist'];

export default function OnboardingScreen() {
  const user = useUserStore((state: any) => state.user); // ✅ suppress implicit any
  const navigation = useNavigation<NavigationProp<RootStackParamList>>(); // ✅ typed navigation
  const [religion, setReligion] = useState(user?.religion ?? 'Christian');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await updateUserFields(user.uid, { religion });
      await completeOnboarding(user.uid);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }], // ✅ match literal from MainStackParamList
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
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
