import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { Picker } from '@react-native-picker/picker';
import { useUser } from '@/hooks/useUser';
import { useUserStore } from '@/state/userStore';
import { getTokenCount } from '@/utils/TokenManager';
import { getDocument, setDocument } from '@/services/firestoreService';
import { useLookupLists } from '@/hooks/useLookupLists';
import { updateUserProfile } from '../../../utils/firestoreHelpers';
import { useTheme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useUser();
  const updateUser = useUserStore((s) => s.updateUser);
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [username, setUsername] = useState(
    user?.username || user?.displayName || ''
  );
  const { regions, religions, loading: listsLoading } = useLookupLists();
  const [region, setRegion] = useState(user?.region || '');
  const [religion, setReligion] = useState(user?.religion ?? 'SpiritGuide');
  const [tokens, setTokens] = useState(0);
  const [points, setPoints] = useState(0);
  const [organization, setOrganization] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [religionUpdating, setReligionUpdating] = useState(false);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        pickerWrapper: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          marginBottom: 16,
          overflow: 'hidden',
          backgroundColor: theme.colors.surface,
        },
        picker: { height: 50, color: theme.colors.text },
        label: { fontSize: 16, marginBottom: 4, color: theme.colors.text },
        info: { fontSize: 16, marginBottom: 8, color: theme.colors.text },
      }),
    [theme]
  );

  useEffect(() => {
    if (!authReady || !uid) return;
    loadData();
  }, [authReady, uid]);


  const loadData = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;
    try {
      const [tokenCount, profile] = await Promise.all([
        getTokenCount(),
        getDocument(`users/${uid}`),
      ]);
      setTokens(tokenCount);
      if (profile) {
        setPoints(profile.individualPoints || 0);
        setUsername(profile.username || profile.displayName || '');
        setRegion(profile.region || '');
        setReligion(profile.religion ?? 'SpiritGuide');
        console.log('🙏 Current religion from Firestore:', profile.religion);
        if (profile.organizationName) {
          setOrganization(profile.organizationName);
        } else if (profile.organizationId) {
          const org = await getDocument(`organizations/${profile.organizationId}`);
          setOrganization(org?.name || '');
        }
      }
    } catch (err) {
      console.error('Profile load error', err);
    }
  };

  useEffect(() => {
    if (!region && regions.length) setRegion(regions[0].name);
    if (!religion && religions.length)
      setReligion(religions[0].id || religions[0].name);
  }, [regions, religions]);

  const handleReligionChange = async (value: string) => {
    if (value === religion) return;
    setReligion(value);
    const uidVal = await ensureAuth(user?.uid);
    if (!uidVal) return;
    setReligionUpdating(true);
    console.log('➡️ Updating religion to', value);
    try {
      await updateUserProfile({ religion: value });
      console.log('✅ Religion updated');
      updateUser({ religion: value });
      await updateUserProfile(uidVal, { lastChallenge: null });
      Alert.alert('Religion Updated');
    } catch (err: any) {
      console.error('Religion update failed', err);
      Alert.alert('Error', err.message || 'Could not update religion');
    } finally {
      setReligionUpdating(false);
    }
  };

  const handleSave = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;
    if (!region) {
      Alert.alert('Missing Info', 'Please select a region.');
      return;
    }
    setSaving(true);
    try {
      const updates: Record<string, any> = { displayName: username, region };
      if (username.trim()) updates.username = username.trim();
      await updateUserProfile(updates);
      updateUser({
        displayName: username,
        ...(username.trim() ? { username } : {}),
        region,
      });
      Alert.alert('Profile Updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  if (listsLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <AuthGate>
    <ScreenContainer>
      <View style={styles.container}>
        <TextField label="Username" value={username} onChangeText={setUsername} />
        <CustomText style={styles.label}>Region</CustomText>
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

        <CustomText style={styles.label}>Religion</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={religion}
            onValueChange={handleReligionChange}
            style={styles.picker}
          >
            {religions.map((r) => (
              <Picker.Item key={r.id || r.name} label={r.name} value={r.id || r.name} />
            ))}
          </Picker>
        </View>
        {religionUpdating && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}

        <CustomText style={styles.info}>Points: {points}</CustomText>
        <CustomText style={styles.info}>Subscribed: {user?.isSubscribed ? 'Yes' : 'No'}</CustomText>
        <CustomText style={styles.info}>Tokens: {tokens}</CustomText>
        <CustomText style={styles.info}>Organization: {organization || 'None'}</CustomText>

        <Button title="Save Changes" onPress={handleSave} loading={saving} />
        <Button title="Change Password" onPress={() => navigation.navigate('ChangePassword')} />
      </View>
    </ScreenContainer>
    </AuthGate>
  );
}
