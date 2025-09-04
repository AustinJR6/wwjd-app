import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/components/theme/theme';

type Props = {
  visible: boolean;
  defaultTitle: string;
  onCancel: () => void;
  onSave: (title: string) => void;
};

export default function SaveReligionMemoryModal({ visible, defaultTitle, onCancel, onSave }: Props) {
  const [title, setTitle] = useState(defaultTitle);
  const theme = useTheme();

  useEffect(() => { setTitle(defaultTitle); }, [defaultTitle]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.h1, { color: theme.colors.text }]}>Name this memory</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: 'transparent' }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., 'Gratitude practice 9/3'"
            autoFocus
            placeholderTextColor={theme.colors.fadedText || '#888'}
            underlineColorAndroid="transparent"
          />
          <View style={styles.row}>
            <Pressable onPress={onCancel} style={[styles.btn, styles.ghost, { borderColor: theme.colors.border }]}><Text style={[styles.ghostText, { color: theme.colors.text }]}>Cancel</Text></Pressable>
            <Pressable onPress={() => onSave(title.trim() || defaultTitle)} style={[styles.btn, { backgroundColor: theme.colors.primary }]}><Text style={styles.btnText}>Save</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '88%', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1 },
  h1: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btn: { backgroundColor: '#F39C12', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  btnText: { color: 'black', fontWeight: '700' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#555' },
  ghostText: { color: '#ddd', fontWeight: '600' },
});
