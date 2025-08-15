import React, { useState, useEffect, useMemo } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { Picker } from '@react-native-picker/picker';
import { useLookupLists } from '@/hooks/useLookupLists';
import { updateUserProfile } from '@/utils/firestoreHelpers';
import { loadUserProfile } from '@/utils/userProfile';
import { useUserProfileStore } from '@/state/userProfile';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { useTheme } from '@/components/theme/theme';
import { useAuth } from '@/hooks/useAuth';
import type { Religion, Region } from '@/services/lookupService';

const FALLBACK_RELIGIONS: Religion[] = [{ id: 'spiritual', name: 'Spiritual' }];
const FALLBACK_REGIONS: Region[] = [{ id: 'unknown', name: 'Unknown' }];

export default function ProfileCompletionScreen() {
  const { uid } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    regions,
    regionsLoading,
    regionsError,
    religions,
    religionsLoading,
    religionsError,
  } = useLookupLists();
  const theme = useTheme();

  const [regionId, setRegionId] = useState('');
  const profileStore = useUserProfileStore();
  const profile = profileStore.profile;
  const [religionId, setReligionId] = useState(profile?.religionId ?? '');
  const [preferredName, setPreferredName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [avatarURL, setAvatarURL] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!uid) return;
      const prof = await loadUserProfile(uid);
      if (prof) {
        profileStore.setUserProfile(prof as any);
        if (prof.religionId) setReligionId(prof.religionId);
      }
    }
    loadProfile();
  }, [uid]);

  const religionOptions = useMemo(
    () =>
      __DEV__ && (religionsError || !religions?.length)
        ? FALLBACK_RELIGIONS
        : religions ?? [],
    [religions, religionsError]
  );

  const regionOptions = useMemo(
    () => (__DEV__ && regionsError ? FALLBACK_REGIONS : regions),
    [regions, regionsError]
  );

  const handleSubmit = async () => {
    if (isLoading || !uid) return;

    const existing = profileStore.profile;
    const hasDisplay = existing?.displayName && existing.displayName.trim();
    const hasUsername = existing?.username && existing.username.trim();

    if (!religionId) {
      Alert.alert('Missing Info', 'Please select a religion.');
      return;
    }
    if (!hasDisplay || !hasUsername || !preferredName.trim()) {
      Alert.alert('Missing Info', 'Preferred name is required.');
      return;
    }

    setIsLoading(true);
      try {
        console.log('[profile-save] setting religionId=', religionId);
        await updateUserProfile(uid, { religionId }, { merge: true });
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
        buttonWrap: { marginTop: 20, width: '100%' },
      }),
    [theme]
  );

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
          {regionsLoading ? (
            <ActivityIndicator />
          ) : (
            <Picker
              selectedValue={regionId}
              onValueChange={(v) => setRegionId(v)}
              style={styles.picker}
            >
              <Picker.Item label="Select a region..." value="" />
              {regionOptions.map((r) => (
                <Picker.Item key={r.id} label={r.name} value={r.id} />
              ))}
            </Picker>
          )}
        </View>
        {regionsError && (
          <CustomText style={{ color: 'tomato' }}>{regionsError}</CustomText>
        )}

        <CustomText style={{ marginBottom: 8 }}>Choose your spiritual lens:</CustomText>
        <View style={styles.pickerWrapper}>
          {religionsLoading ? (
            <ActivityIndicator />
          ) : (
            <Picker
              selectedValue={religionId}
              onValueChange={(v) => setReligionId(v)}
              style={styles.picker}
              mode="dropdown"
            >
              <Picker.Item label="Select a religion…" value="" />
              {religionOptions.map((r) => (
                <Picker.Item key={r.id} label={r.name} value={r.id} />
              ))}
            </Picker>
          )}
        </View>
        {religionsError && (
          <CustomText style={{ color: 'tomato' }}>{religionsError}</CustomText>
        )}

        <View style={styles.buttonWrap}>
          <Button
            title="Complete Profile"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
