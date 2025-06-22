import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import { View, StyleSheet, Alert } from 'react-native';
import ScreenContainer from '@/components/theme/ScreenContainer';
import TextField from '@/components/TextField';
import Button from '@/components/common/Button';
import { Picker } from '@react-native-picker/picker';
import { useUser } from '@/hooks/useUser';
import { useUserStore } from '@/state/userStore';
import { getTokenCount } from '@/utils/TokenManager';
import { getDocument, setDocument } from '@/services/firestoreService';
import { updateUserFields } from '@/services/userService';
import { useTheme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';

const RELIGIONS = ['Christianity', 'Islam', 'Judaism', 'Buddhism', 'Hinduism'];

export default function ProfileScreen() {
  const { user } = useUser();
  const updateUser = useUserStore((s) => s.updateUser);
  const theme = useTheme();
  const [username, setUsername] = useState(user?.displayName || '');
  const [region, setRegion] = useState(user?.region || '');
  const [religion, setReligion] = useState(user?.religion || RELIGIONS[0]);
  const [tokens, setTokens] = useState(0);
  const [points, setPoints] = useState(0);
  const [organization, setOrganization] = useState<string>('');
  const [saving, setSaving] = useState(false);

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
    loadData();
  }, []);

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
        if (profile.organizationId) {
          const org = await getDocument(`organizations/${profile.organizationId}`);
          setOrganization(org?.name || '');
        }
      }
    } catch (err) {
      console.error('Profile load error', err);
    }
  };

  const handleSave = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;
    setSaving(true);
    try {
      await updateUserFields(uid, { displayName: username, region, religion });
      updateUser({ displayName: username, region, religion });
      if (religion !== user?.religion) {
        await setDocument(`users/${uid}`, { lastChallenge: null });
      }
      Alert.alert('Profile Updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <TextField label="Username" value={username} onChangeText={setUsername} />
        <TextField label="Region" value={region} onChangeText={setRegion} />

        <CustomText style={styles.label}>Religion</CustomText>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={religion}
            onValueChange={(v) => setReligion(v)}
            style={styles.picker}
          >
            {RELIGIONS.map((r) => (
              <Picker.Item key={r} label={r} value={r} />
            ))}
          </Picker>
        </View>

        <CustomText style={styles.info}>Points: {points}</CustomText>
        <CustomText style={styles.info}>Subscribed: {user?.isSubscribed ? 'Yes' : 'No'}</CustomText>
        <CustomText style={styles.info}>Tokens: {tokens}</CustomText>
        <CustomText style={styles.info}>Organization: {organization || 'None'}</CustomText>

        <Button title="Save Changes" onPress={handleSave} loading={saving} />
      </View>
    </ScreenContainer>
  );
}
