import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  FlatList,
  StyleSheet,
  Alert
} from 'react-native';
import Button from '@/components/common/Button';
import { useUser } from '@/hooks/useUser';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { useTheme } from '@/components/theme/theme';
import { queryCollection, setDocument, getDocument } from '@/services/firestoreService';
import { updateUserProfile } from '@/utils/firestoreHelpers';
import { getAuthHeaders } from '@/utils/TokenManager';
import { ensureAuth } from '@/utils/authGuard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/state/userStore';

export default function JoinOrganizationScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const updateUser = useUserStore((s) => s.updateUser);
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 20,
          textAlign: 'center',
        }, // ✅ added missing 'title' style
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        item: { padding: 12, borderBottomWidth: 1, borderColor: theme.colors.border },
        itemName: { color: theme.colors.text },
        buttonWrap: { marginTop: 24, alignItems: 'center' },
        row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.border }, // ✅ added missing 'row' style
        infoWrap: { flex: 1, marginRight: 8 }, // ✅ added missing 'infoWrap' style
        name: { fontSize: 16, fontWeight: '600', color: theme.colors.text }, // ✅ added missing 'name' style
        meta: { color: theme.colors.fadedText, fontSize: 14 }, // ✅ added missing 'meta' style
      }),
    [theme],
  );
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [orgs, setOrgs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!authReady || !uid) return;
    fetchOrgs();
  }, [authReady, uid]);

  const fetchOrgs = async () => {
    try {
      try {
        await getAuthHeaders();
      } catch {
        Alert.alert('Login Required', 'Please log in again.');
        return;
      }

      const uid = await ensureAuth(user?.uid);
      if (!uid) return;

      const all = await queryCollection('organizations');
      setOrgs(all);
      setFiltered(all);
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
    }
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    setFiltered(
      orgs.filter((o) =>
        o.name.toLowerCase().includes(text.toLowerCase())
      )
    );
  };

  const leaveOrganization = async (orgId: string) => {
    if (!user) return;
    const uid = await ensureAuth(user.uid);
    if (!uid) return;
    try {
      await updateUserProfile(uid, {
        organizationId: null,
        organizationName: null,
      });

      updateUser({ organizationId: undefined });

      const orgData = await getDocument(`organizations/${orgId}`);
      const members = (orgData?.members || []).filter((m: string) => m !== uid);
      await setDocument(`organizations/${orgId}`, { members });
    } catch (err: any) {
      console.error('🔥 Leave org error:', err?.response?.data || err.message);
    }
  };

  const joinOrg = async (org: any) => {
    if (!user) return;
    try {
      await getAuthHeaders();
    } catch {
      Alert.alert('Login Required', 'Please log in again.');
      return;
    }
    const uid = await ensureAuth(user.uid);
    if (!uid) return;

    const profile = await getDocument(`users/${uid}`);
    if (profile?.organizationId) {
      Alert.alert(
        'Already Joined',
        'You must leave your current organization to join a new one.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave current org',
            onPress: async () => {
              await leaveOrganization(profile.organizationId);
              await joinOrg(org);
            },
          },
        ],
      );
      return;
    }

    if ((org.members?.length || 0) >= org.seatLimit) {
      Alert.alert('Full', 'This organization has no available seats.');
      return;
    }

    try {
      await updateUserProfile(uid, {
        organizationId: org.id,
        organizationName: org.name,
      });

      updateUser({ organizationId: org.id });

      const orgData = await getDocument(`organizations/${org.id}`);
      const members = orgData?.members || [];
      await setDocument(`organizations/${org.id}`, {
        members: [...members, user.uid],
      });

      Alert.alert('Joined', `You’ve joined ${org.name}.`);
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <CustomText style={styles.title}>Join an Organization</CustomText>
      <TextInput
        style={styles.input}
        placeholder="Search by name"
        value={query}
        onChangeText={handleSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.infoWrap}>
              <CustomText style={styles.name}>{item.name}</CustomText>
              <CustomText style={styles.meta}>Tier: {item.tier}</CustomText>
              <CustomText style={styles.meta}>
                Seats: {item.members?.length || 0} / {item.seatLimit}
              </CustomText>
            </View>
            <Button title="Join" onPress={() => joinOrg(item)} />
          </View>
        )}
      />
    </ScreenContainer>
    </AuthGate>
  );
}

