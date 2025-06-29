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
import { getAuthHeaders } from '@/config/firebaseApp';
import { ensureAuth } from '@/utils/authGuard';
import * as SafeStore from '@/utils/secureStore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

export default function JoinOrganizationScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
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
    if (!authReady) return;
    if (!uid) {
      navigation.replace('Login');
      return;
    }
    fetchOrgs();
  }, [authReady, uid]);

  const fetchOrgs = async () => {
    try {
      try {
        await getAuthHeaders();
      } catch {
        Alert.alert('Login Required', 'Please log in again.');
        navigation.replace('Login');
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

  const joinOrg = async (org: any) => {
    if (!user) return;
    try {
      await getAuthHeaders();
    } catch {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
      return;
    }
    const uid = await ensureAuth(user.uid);
    if (!uid) return;
    if ((org.members?.length || 0) >= org.seatLimit) {
      Alert.alert('Full', 'This organization has no available seats.');
      return;
    }

    try {
      await setDocument(`users/${uid}`, { organizationId: org.id });

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

