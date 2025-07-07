import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import axios from 'axios';
import { fetchTopUsersByPoints } from '@/services/firestoreService';
import { logFirestoreError } from '@/lib/logging';
import Constants from 'expo-constants';
import { showGracefulError } from '@/utils/gracefulError';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { ensureAuth } from '@/utils/authGuard';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

const PROJECT_ID =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
if (!PROJECT_ID) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env');
}

async function fetchTopReligions(idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const payload = {
    structuredQuery: {
      from: [{ collectionId: 'religion' }],
      orderBy: [
        { field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' },
      ],
      limit: 10,
    },
  };
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const data = response.data as any[];
    return data
      .map((doc: any) => doc.document)
      .filter(Boolean)
      .map((doc: any) => ({
        name: doc.fields?.name?.stringValue,
        totalPoints: parseInt(doc.fields?.totalPoints?.integerValue || '0'),
      }));
  } catch (err: any) {
    logFirestoreError('QUERY', 'runQuery religion', err);
    throw err;
  }
}

async function fetchTopOrganizations(idToken: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const payload = {
    structuredQuery: {
      from: [{ collectionId: 'organizations' }],
      orderBy: [
        { field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' },
      ],
      limit: 10,
    },
  };
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const data = response.data as any[];
    return data
      .map((doc: any) => doc.document)
      .filter(Boolean)
      .map((doc: any) => ({
        name: doc.fields?.name?.stringValue,
        totalPoints: parseInt(doc.fields?.totalPoints?.integerValue || '0'),
      }));
  } catch (err: any) {
    logFirestoreError('QUERY', 'runQuery organizations', err);
    throw err;
  }
}

export default function LeaderboardScreen() {
  const theme = useTheme();
  const { authReady, uid, idToken } = useAuth();
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
        item: {
          marginBottom: 8,
          padding: 12,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
        },
        itemText: { color: theme.colors.text },
        section: {
          marginBottom: 24,
          padding: 16,
          backgroundColor: '#fff',
          borderRadius: 12,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 2,
        }, // ✅ added missing 'section' style
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          marginBottom: 8,
          color: theme.colors.text,
        }, // ✅ added missing 'sectionTitle' style
        row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 }, // ✅ added missing 'row' style
        rank: { width: 30, color: theme.colors.text, fontWeight: 'bold' }, // ✅ added missing 'rank' style
        name: { flex: 1, color: theme.colors.text }, // ✅ added missing 'name' style
        points: { color: theme.colors.accent }, // ✅ added missing 'points' style
      }),
    [theme],
  );
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [religions, setReligions] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [noData, setNoData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) return;
    fetchData();
  }, [authReady, uid]);

  const fetchData = async () => {
    setLoading(true);
    setNoData(false);
    try {
      const authedUid = await ensureAuth();
      if (!authedUid) {
        setLoading(false);
        return;
      }

      const [top, rel, org] = await Promise.all([
        fetchTopUsersByPoints(10),
        idToken ? fetchTopReligions(idToken) : [],
        idToken ? fetchTopOrganizations(idToken) : [],
      ]);

      console.log('🏆 Leaderboard results', { top, rel, org });
      setIndividuals(top);
      setReligions(rel);
      setOrganizations(org);
      if (top.length === 0 && rel.length === 0 && org.length === 0) {
        setNoData(true);
      } else {
        setNoData(false);
      }
    } catch (err: any) {
      console.error('🔥 Error loading leaderboards:', err?.response?.data || err?.message || err);
      setNoData(true);
      showGracefulError('Unable to load leaderboard — please try again later');
    } finally {
      setLoading(false);
    }
  };

  const renderList = (
    title: string,
    data: any[],
    keyName: string,
    valueName: string,
  ) => (
    <View style={styles.section}>
      <CustomText style={styles.sectionTitle}>{title}</CustomText>
      {data.length === 0 ? (
        <CustomText>No leaders yet!</CustomText>
      ) : (
        data.map((item, index) => (
          <View key={item.id || index} style={styles.row}>
            <CustomText style={styles.rank}>{index + 1}.</CustomText>
            <CustomText style={styles.name}>
              {item[keyName] || item.displayName || item.email}
            </CustomText>
            <CustomText style={styles.points}>{item[valueName]} pts</CustomText>
          </View>
        ))
      )}
    </View>
  );

  return (
    <AuthGate>
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.title}>Leaderboards</CustomText>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : noData ? (
          <CustomText>No leaderboard data available yet.</CustomText>
        ) : (
          <>
            {renderList('Top Individuals', individuals, 'email', 'individualPoints')}
            {renderList('Top Religions', religions, 'name', 'totalPoints')}
            {renderList('Top Organizations', organizations, 'name', 'totalPoints')}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}


