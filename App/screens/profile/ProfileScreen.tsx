import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { Picker } from '@react-native-picker/picker';
import { useUser } from '@/hooks/useUser';
import { useUserProfileStore } from '@/state/userProfile';
import { getTokenCount } from '@/utils/TokenManager';
import { useLookupLists } from '@/hooks/useLookupLists';
import {
  loadUserProfile,
  updateUserProfile,
  setCachedUserProfile,
} from '@/utils/userProfile';
import { listReligions, Religion } from '@/lib/firestoreRest';
import type { UserProfile } from '../../../types';
import { getDocument } from '@/services/firestoreService';
import { useTheme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useUser();
  const setProfile = useUserProfileStore((s) => s.setUserProfile);
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [username, setUsername] = useState(
    user?.username || user?.displayName || ''
  );
  const { regions, loading: regionLoading } = useLookupLists();
  const [region, setRegion] = useState(user?.region || '');
  const [religionId, setReligionId] = useState(user?.religion ?? 'spiritual');
  const [religions, setReligions] = useState<Religion[]>([]);
  const [religionsLoading, setReligionsLoading] = useState(true);
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
      const [tokenCount, loaded] = await Promise.all([
        getTokenCount(),
        loadUserProfile(uid),
      ]);
      const profile: UserProfile | null = loaded;
      setTokens(tokenCount);
      if (profile) {
        setPoints(profile.individualPoints || 0);
        setUsername(profile.username || profile.displayName || '');
        setRegion(profile.region || '');
        setReligionId(profile.religionId || profile.religion || 'spiritual');
        console.log('🙏 Current religion from Firestore:', profile.religionId || profile.religion);
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
  }, [regions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listReligions();
        if (!cancelled) {
          setReligions(rows.length ? rows : [{ id: 'spiritual', name: 'Spiritual' }]);
        }
      } catch {
        if (!cancelled) setReligions([{ id: 'spiritual', name: 'Spiritual' }]);
        console.warn('[religion] dropdown fetch failed');
      } finally {
        if (!cancelled) setReligionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!religionId && religions.length) setReligionId(religions[0].id);
  }, [religions]);

  const handleReligionChange = async (value: string) => {
    if (value === religionId) return;
    setReligionId(value);
    const uidVal = await ensureAuth(user?.uid);
    if (!uidVal) return;
    setReligionUpdating(true);
    console.log('➡️ Updating religion to', value);
    try {
      await updateUserProfile({ religionId: value, religion: value });
      console.log('✅ Religion updated');
      const updated = await loadUserProfile(uidVal);
      setCachedUserProfile(updated as any);
      setProfile({ ...user, religion: value, religionId: value } as any);
      await updateUserProfile({ lastChallenge: null }, uidVal);
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
      if (user) {
        setProfile({
          ...user,
          displayName: username,
          ...(username.trim() ? { username } : {}),
          region,
        } as any);
      }
      Alert.alert('Profile Updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  if (regionLoading || religionsLoading) {
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
            selectedValue={religionId}
            onValueChange={handleReligionChange}
            style={styles.picker}
            enabled={!religionsLoading}
          >
            {religions.map((r) => (
              <Picker.Item key={r.id} label={r.name} value={r.id} />
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
