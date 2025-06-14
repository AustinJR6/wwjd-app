import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Button from '@/components/common/Button';
import { getDocument, setDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { theme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';

export default function OrganizationManagementScreen() {
  const { user } = useUser();
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const checkAccess = async () => {
      const admin = await SecureStore.getItemAsync('isAdmin');
      const manager = await SecureStore.getItemAsync('isOrgManager');
      if (admin !== 'true' && manager !== 'true') {
        Alert.alert('Access Denied', 'This feature is for OneVine+ or Org Managers only.');
        navigation.goBack();
      }
    };
    checkAccess();
  }, []);

  useEffect(() => {
    if (user) loadOrg();
  }, [user]);

  const loadOrg = async () => {
    if (!user) return;
    const idToken = await getStoredToken();
    const userId = await SecureStore.getItemAsync('userId');
    if (!idToken || !userId) {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
      return;
    }
    const uid = await ensureAuth(user.uid);
    if (!uid) return;
    setLoading(true);
    try {
      const userSnap = await getDocument(`users/${uid}`);
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
    const idToken = await getStoredToken();
    const userId = await SecureStore.getItemAsync('userId');
    if (!idToken || !userId) {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
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
      <ScreenContainer>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </ScreenContainer>
    );
  }

  if (!org) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>No organization found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>{org.name}</Text>
      <Text style={styles.subtitle}>Tier: {org.tier}</Text>
      <Text style={styles.subtitle}>
        Seats Used: {org.members?.length || 0} / {org.seatLimit}
      </Text>

      <Text style={styles.sectionTitle}>Members</Text>
      <FlatList
        data={org.members || []}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.memberText}>{item}</Text>
            <Button title="Remove" onPress={() => removeMember(item)} />
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
    color: theme.colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: theme.colors.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  memberText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
});
