import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { queryCollection } from '@/services/firestoreService';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { ensureAuth } from '@/utils/authGuard';

export default function LeaderboardsScreen() {
  const theme = useTheme();
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
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uid = await ensureAuth();
      if (!uid) {
        setLoading(false);
        return;
      }

      const userSnap = await queryCollection('users', 'individualPoints');
      const religionSnap = await queryCollection('religions', 'totalPoints');
      const orgSnap = await queryCollection('organizations', 'totalPoints');

      setIndividuals(userSnap);
      setReligions(religionSnap);
      setOrganizations(orgSnap);
    } catch (err) {
      console.error('🔥 Error loading leaderboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderList = (title: string, data: any[], keyName: string, valueName: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.map((item, index) => (
        <View key={item.id || index} style={styles.row}>
          <Text style={styles.rank}>{index + 1}.</Text>
          <Text style={styles.name}>{item[keyName]}</Text>
          <Text style={styles.points}>{item[valueName]} pts</Text>
        </View>
      ))}
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Leaderboards</Text>
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
  );
}


