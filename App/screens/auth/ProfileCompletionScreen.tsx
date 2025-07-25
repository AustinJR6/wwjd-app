import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Text,
} from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import { Picker } from '@react-native-picker/picker';
import { useLookupLists } from '@/hooks/useLookupLists';
import { getDocument, updateDocument } from '@/services/firestoreService';
import { updateUserProfile, loadUserProfile } from '@/utils/userProfile';
import { useUserProfileStore } from '@/state/userProfile';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useTheme } from '@/components/theme/theme';
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
  const [isLoading, setIsLoading] = useState(false);
  const profileStore = useUserProfileStore();

  useEffect(() => {
    async function loadProfile() {
      if (!uid) return;
      const prof = await loadUserProfile(uid);
      if (prof) profileStore.setUserProfile(prof as any);
    }
    loadProfile();
  }, [uid]);

  useEffect(() => {
    if (!region && regions.length) setRegion(regions[0].name);
    if (!religion && religions.length) setReligion(religions[0].id);
  }, [regions, religions]);

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!uid) return;
    const existing = profileStore.profile;
    const hasDisplay = existing?.displayName && existing.displayName.trim();
    const hasUsername = existing?.username && existing.username.trim();
    if (!region || !religion) {
      Alert.alert('Missing Info', 'Please select a region and religion.');
      return;
    }
    if (!hasDisplay || !hasUsername || !preferredName.trim()) {
      Alert.alert('Missing Info', 'Preferred name is required.');
      return;
    }
    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        region,
        religion,
        preferredName: preferredName.trim(),
        onboardingComplete: true,
        profileComplete: true,
      };
      if (pronouns.trim()) payload.pronouns = pronouns.trim();
      if (avatarURL.trim()) payload.avatarURL = avatarURL.trim();

      const regionPath = `regions/${region.toLowerCase()}`;
      const religionPath = `religion/${religion}`;

      const [regionDoc, religionDoc] = await Promise.all([
        getDocument(regionPath),
        getDocument(religionPath),
      ]);

      const regionCount = regionDoc?.userCount ?? 0;
      const religionCount = religionDoc?.userCount ?? 0;

      await Promise.all([
        updateDocument(regionPath, { userCount: regionCount + 1 }),
        updateDocument(religionPath, { userCount: religionCount + 1 }),
        updateUserProfile(payload, uid),
      ]);
      await profileStore.refreshUserProfile();

      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save profile or update counts');
      console.error('❌ Failed to complete profile:', err);
    } finally {
      setIsLoading(false);
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
        submitButton: {
          backgroundColor: '#4B8DF8',
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: 10,
          alignItems: 'center',
          marginTop: 20,
          width: '100%',
        },
        submitButtonText: {
          color: 'white',
          fontWeight: 'bold',
          fontSize: 16,
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
          label="Preferred Name *"
          value={preferredName}
          onChangeText={setPreferredName}
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

        <Pressable
          onPress={handleSubmit}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && { opacity: 0.8 },
            isLoading && { backgroundColor: '#aaa' },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Complete</Text>
          )}
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
