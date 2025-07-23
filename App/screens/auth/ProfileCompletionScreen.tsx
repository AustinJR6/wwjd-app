import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { Picker } from '@react-native-picker/picker';
import { useLookupLists } from '@/hooks/useLookupLists';
import { firestore } from '@/config/firebaseClient';
import { doc, runTransaction } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useTheme } from '@/components/theme/theme';
import { SCREENS } from '@/navigation/screens';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileCompletionScreen() {
  const { uid } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { regions, religions, loading } = useLookupLists();
  const theme = useTheme();

  const [region, setRegion] = useState('');
  const [religion, setReligion] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [avatarURL, setAvatarURL] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!region && regions.length) setRegion(regions[0].name);
    if (!religion && religions.length) setReligion(religions[0].id);
  }, [regions, religions]);

  const handleComplete = async () => {
    if (!uid) return;
    if (!region || !religion) {
      Alert.alert('Missing Info', 'Please select a region and religion.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        region,
        religion,
        onboardingComplete: true,
        profileComplete: true,
      };
      if (preferredName.trim()) payload.preferredName = preferredName.trim();
      if (pronouns.trim()) payload.pronouns = pronouns.trim();
      if (avatarURL.trim()) payload.avatarURL = avatarURL.trim();

      await runTransaction(firestore, async (transaction) => {
        const regionRef = doc(firestore, 'regions', region);
        const religionRef = doc(firestore, 'religion', religion);
        const userRef = doc(firestore, 'users', uid);

        const regionDoc = await transaction.get(regionRef);
        const religionDoc = await transaction.get(religionRef);

        const regionCount = regionDoc.exists() ? (regionDoc.data().userCount ?? 0) : 0;
        const religionCount = religionDoc.exists() ? (religionDoc.data().userCount ?? 0) : 0;

        transaction.set(regionRef, { userCount: regionCount + 1 }, { merge: true });
        transaction.set(religionRef, { userCount: religionCount + 1 }, { merge: true });
        transaction.set(userRef, payload, { merge: true });
      });

      navigation.reset({ index: 0, routes: [{ name: SCREENS.MAIN.HOME }] });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save profile or update counts');
      console.error('Transaction failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
        },
        pickerWrapper: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          marginBottom: 20,
          overflow: 'hidden',
          backgroundColor: theme.colors.surface,
        },
        picker: { height: 50, color: theme.colors.text },
        link: {
          marginTop: 20,
          color: theme.colors.primary,
          textAlign: 'center',
        },
      }),
    [theme]
  );

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.lg }}>
        <CustomText style={styles.title}>Complete Your Profile</CustomText>
        <TextField
          label="Preferred Name"
          value={preferredName}
          onChangeText={setPreferredName}
          placeholder="Optional"
        />
        <TextField
          label="Pronouns"
          value={pronouns}
          onChangeText={setPronouns}
          placeholder="Optional"
        />
        <TextField
          label="Avatar URL"
          value={avatarURL}
          onChangeText={setAvatarURL}
          placeholder="Optional"
        />

        <CustomText style={{ marginBottom: 8 }}>Select your region:</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={region}
            onValueChange={(v) => setRegion(v)}
            style={styles.picker}
          >
            {regions.map((r) => (
              <Picker.Item key={r.id} label={r.name} value={r.name} />
            ))}
          </Picker>
        </View>

        <CustomText style={{ marginBottom: 8 }}>Choose your spiritual lens:</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={religion}
            onValueChange={(v) => setReligion(v)}
            style={styles.picker}
          >
            {religions.map((r) => (
              <Picker.Item key={r.id} label={r.id} value={r.id} />
            ))}
          </Picker>
        </View>

        <Button title="Complete Profile" onPress={handleComplete} loading={saving} />
      </ScrollView>
    </ScreenContainer>
  );
}
