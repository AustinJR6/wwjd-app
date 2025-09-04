import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import type { ReligionMemory } from '@/types/religion';
import { listReligionMemoriesREST, searchReligionMemoriesLocal } from '@/lib/religionMemoryStore';
import { useTheme } from '@/components/theme/theme';

type Props = {
  uid: string;
  isOpen: boolean;
  onClose: () => void;
  onPick: (m: ReligionMemory) => void; // inject memory into session
  refreshKey?: number;
};

export default function ReligionMemoriesDrawer({ uid, isOpen, onClose, onPick, refreshKey = 0 }: Props) {
  const theme = useTheme();
  const th = {
    text: theme.colors.text,
    textMuted: theme.colors.fadedText || '#888',
    surface: theme.colors.surface,
    border: theme.colors.border,
    bg: theme.colors.card,
    accent: theme.colors.primary,
  };
  const [items, setItems] = useState<ReligionMemory[]>([]);
  const [display, setDisplay] = useState<ReligionMemory[]>([]);
  const [q, setQ] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen || !uid) return;
    (async () => {
      try {
        const rows = await listReligionMemoriesREST(uid, 100);
        setItems(rows);
        setDisplay(rows);
      } catch (e) {
        console.warn('Memories list (REST) failed', e);
        setItems([]);
        setDisplay([]);
      }
    })();
  }, [isOpen, uid, refreshKey]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const filtered = await searchReligionMemoriesLocal(items, q);
      setDisplay(filtered);
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, items]);

  if (!isOpen) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: th.surface, borderLeftColor: th.border }]}>
      <View style={styles.head}>
        <Text style={[styles.h1, { color: th.text }]}>Memories</Text>
        <Pressable onPress={onClose}><Text style={[styles.close, { color: th.textMuted }]}>Close</Text></Pressable>
      </View>
      <TextInput
        style={[styles.search, { color: th.text, borderColor: th.border, backgroundColor: 'transparent' }]}
        value={q}
        onChangeText={setQ}
        placeholder="Search by title or summary"
        placeholderTextColor={th.textMuted}
      />
      <FlatList
        data={display}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPick(item)} style={[styles.card, { backgroundColor: th.bg, borderColor: th.border }]}>
            <Text style={[styles.title, { color: th.text }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: th.textMuted }]}>{new Date(item.createdAt).toLocaleString()}</Text>
            {!!item.summary && <Text style={[styles.summary, { color: th.textMuted }]}>{item.summary}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ color: th.textMuted, paddingVertical: 8 }}>No memories yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '88%', padding: 12, borderLeftWidth: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: '700' },
  close: {},
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  title: { fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  summary: { marginTop: 6 },
});
