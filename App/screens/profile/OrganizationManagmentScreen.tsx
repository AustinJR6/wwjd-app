import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { db } from '../../config/firebaseConfig';
import {
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
  arrayUnion,
} from 'firebase/firestore';
import { useUser } from '../../hooks/useUser';
import ScreenContainer from '../../components/theme/ScreenContainer';
import { theme } from '../../components/theme/theme';

export default function OrganizationManagementScreen() {
  const { user } = useUser();
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadOrg();
  }, [user]);

  const loadOrg = async () => {
    if (!user) return; // ✅ FIX: Ensure user is not null
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const orgId = userSnap.data()?.organizationId;
      if (!orgId) throw new Error('No organization found');

      const orgSnap = await getDoc(doc(db, 'organizations', orgId));
      setOrg({ id: orgId, ...orgSnap.data() });
    } catch (err) {
      console.error('❌ Failed to load org:', err);
      Alert.alert('Error', 'Unable to load your organization.');
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        members: arrayRemove(uid),
      });
      Alert.alert('Removed', 'Member removed from organization.');
      loadOrg();
    } catch (err) {
      console.error('❌ Remove member error:', err);
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
