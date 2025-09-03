import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Switch, TextInput } from 'react-native';
import CustomText from '@/components/CustomText';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/components/theme/theme';
import { ensureAuth } from '@/utils/authGuard';
import { getCurrentUserId } from '@/utils/authUtils';
import { runSubcollectionQuery } from '@/services/firestoreService';
import { Button } from '@/components/ui/Button';
import { endpoints } from '@/services/endpoints';
import { getAuthHeaders } from '@/utils/authUtils';

type Memory = { id: string; text: string; importance: number; decayScore: number; pinned?: boolean };

export default function ManageMemories() {
  const theme = useTheme();
  const [items, setItems] = useState<Memory[]>([]);
  const [search, setSearch] = useState('');

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        row: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
        title: { fontWeight: '600', color: theme.colors.text },
        meta: { color: theme.colors.fadedText, fontSize: 12 },
        search: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 8, color: theme.colors.text, margin: 12 },
      }),
    [theme],
  );

  useEffect(() => {
    (async () => {
      const uid = await ensureAuth(await getCurrentUserId());
      if (!uid) return;
      const docs = await runSubcollectionQuery(`users/${uid}`, 'memories', {
        orderByField: 'updatedAt',
        direction: 'DESCENDING',
      });
      setItems(docs as Memory[]);
    })();
  }, []);

  const filtered = items.filter((m) => !search.trim() || (m.text || '').toLowerCase().includes(search.toLowerCase()));

  const togglePin = async (id: string, pinned: boolean) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(endpoints.setPinnedMemories, {
        method: 'POST',
        headers,
        body: JSON.stringify({ memoryId: id, pinned }),
      });
      setItems((arr) => arr.map((m) => (m.id === id ? { ...m, pinned } : m)));
    } catch {}
  };

  return (
    <Screen>
      <TextInput style={styles.search} placeholder="Search memories" value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <CustomText style={styles.title}>{item.text}</CustomText>
            <CustomText style={styles.meta}>importance: {item.importance} • decay: {item.decayScore?.toFixed?.(2) || '1.00'}</CustomText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <CustomText style={styles.meta}>Pinned</CustomText>
              <Switch value={!!item.pinned} onValueChange={(v) => togglePin(item.id, v)} />
            </View>
          </View>
        )}
      />
      <View style={{ padding: 12 }}>
        <Button title="Back" onPress={() => {}} />
      </View>
    </Screen>
  );
}

