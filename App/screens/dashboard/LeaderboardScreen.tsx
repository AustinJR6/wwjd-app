import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { queryCollection } from '@/services/firestoreService';
import { showGracefulError } from '@/utils/gracefulError';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { ensureAuth } from '@/utils/authGuard';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

export default function LeaderboardsScreen() {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) return;
    fetchData();
  }, [authReady, uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uid = await ensureAuth();
      if (!uid) {
        setLoading(false);
        return;
      }

      const userSnap = await queryCollection('users', 'individualPoints');
      const religionSnap = await queryCollection('religion', 'totalPoints');
      const orgSnap = await queryCollection('organizations', 'totalPoints');

      setIndividuals(userSnap.slice(0, 10));
      setReligions(religionSnap.slice(0, 10));
      setOrganizations(orgSnap.slice(0, 10));
    } catch (err) {
      console.error('🔥 Error loading leaderboards:', err);
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


