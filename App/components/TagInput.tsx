import React, { useRef, useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { MAX_TAG_LEN, MAX_TAGS } from '@/types/UserProfileExtended';

type Props = {
  label: string;
  value: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
};

export default function TagInput({ label, value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canAddMore = value.length < MAX_TAGS;
  const remaining = MAX_TAGS - value.length;

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!canAddMore) return;
    if (trimmed.length > MAX_TAG_LEN) return;
    if (value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft('');
  }

  function onKeyPress({ nativeEvent }: any) {
    if (nativeEvent.key === 'Enter' || nativeEvent.key === ',') {
      commitDraft();
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {value.map((tag) => (
          <View key={tag} style={styles.chip}>
            <Text style={styles.chipText}>{tag}</Text>
            <Pressable onPress={() => removeTag(tag)} hitSlop={8}>
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={draft}
          placeholder={placeholder ?? 'Type and press Enter'}
          onChangeText={setDraft}
          onKeyPress={onKeyPress}
          onSubmitEditing={commitDraft}
          returnKeyType="done"
          blurOnSubmit={false}
        />
      </View>
      <Text style={styles.helper}>
        {remaining} left • {MAX_TAG_LEN} char max each
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#222',
  },
  chipText: { color: 'white' },
  remove: { marginLeft: 6, color: '#bbb', fontSize: 16 },
  input: { minWidth: 120, paddingVertical: 6, paddingHorizontal: 8 },
  helper: { color: '#888', fontSize: 12, marginTop: 2 },
});

