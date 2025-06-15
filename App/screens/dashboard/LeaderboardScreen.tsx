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
import { theme } from "@/components/theme/theme";
import { ensureAuth } from '@/utils/authGuard';

export default function LeaderboardsScreen() {
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

const styles = StyleSheet.create({
  container: {
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: theme.colors.primary,
    marginBottom: 20
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.accent,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  rank: {
    width: 24,
    fontWeight: 'bold'
  },
  name: {
    flex: 1,
    fontSize: 16
  },
  points: {
    fontWeight: '600'
  }
});

