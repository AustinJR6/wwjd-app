import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator} from 'react-native';
import { Button } from '@/components/ui/Button';
import { getDocument, setDocument } from '@/services/firestoreService';
import { loadUserProfile } from '@/utils/userProfile';
import { useUser } from '@/hooks/useUser';
import { getAuthHeaders } from '@/utils/TokenManager';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function OrganizationManagementScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 16,
          textAlign: 'center',
          color: theme.colors.primary,
        },
        subtitle: {
          fontSize: 16,
          color: theme.colors.text,
          marginBottom: 8,
          textAlign: 'center',
        }, // ✅ added missing 'subtitle' style
        item: {
          padding: 12,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
        itemText: { color: theme.colors.text },
        buttonWrap: { marginTop: 24, alignItems: 'center' },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          marginTop: 16,
          marginBottom: 8,
          color: theme.colors.text,
        }, // ✅ added missing 'sectionTitle' style
        row: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        }, // ✅ added missing 'row' style
        memberText: { flex: 1, color: theme.colors.text }, // ✅ added missing 'memberText' style
      }),
    [theme],
  );
  const { user } = useUser();
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isPlus, loading: subLoading } = useSubscriptionStatus(uid);
  useEffect(() => {
    const checkAccess = async () => {
      const admin = await SecureStore.getItemAsync('isAdmin');
      const manager = await SecureStore.getItemAsync('isOrgManager');
      if (!subLoading && !isPlus && admin !== 'true' && manager !== 'true') {
        Alert.alert('Access Denied', 'This feature is for OneVine+ or Org Managers only.');
        navigation.goBack();
      }
    };
    checkAccess();
  }, [isPlus, subLoading, navigation]);

  useEffect(() => {
    if (!authReady || !uid) return;
    if (user) loadOrg();
  }, [authReady, uid, user]);

  const loadOrg = async () => {
    if (!user) return;
    try {
      await getAuthHeaders();
    } catch {
      Alert.alert('Login Required', 'Please log in again.');
      return;
    }
    const uid = await ensureAuth(user.uid);
    if (!uid) return;
    setLoading(true);
    try {
      const userSnap = await loadUserProfile(uid);
      const orgId = userSnap?.organizationId;
      if (!orgId) throw new Error('No organization found');

      const orgSnap = await getDocument(`organizations/${orgId}`);
      setOrg({ id: orgId, ...orgSnap });
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (uid: string) => {
    if (!org?.id) return;
    try {
      await getAuthHeaders();
    } catch {
      Alert.alert('Login Required', 'Please log in again.');
      return;
    }
    const authUid = await ensureAuth(user?.uid);
    if (!authUid) return;

    try {
      const orgData = await getDocument(`organizations/${org.id}`);
      const members = (orgData?.members || []).filter((m: string) => m !== uid);
      await setDocument(`organizations/${org.id}`, { members });

      Alert.alert('Removed', 'Member removed from organization.');
      loadOrg();
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Screen>
    );
  }

  if (!org) {
    return (
      <Screen>
        <CustomText style={styles.title}>No organization found</CustomText>
      </Screen>
    );
  }

  return (
    <AuthGate>
    <Screen>
      <CustomText style={styles.title}>{org.name}</CustomText>
      <CustomText style={styles.subtitle}>Tier: {org.tier}</CustomText>
      <CustomText style={styles.subtitle}>
        Seats Used: {org.members?.length || 0} / {org.seatLimit}
      </CustomText>

      <CustomText style={styles.sectionTitle}>Members</CustomText>
      <FlatList
        data={org.members || []}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <CustomText style={styles.memberText}>{item}</CustomText>
            <Button title="Remove" onPress={() => removeMember(item)} />
          </View>
        )}
      />
    </Screen>
    </AuthGate>
  );
}

