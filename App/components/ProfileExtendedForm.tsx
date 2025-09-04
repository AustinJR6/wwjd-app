import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { type UserProfileExtended, MAX_BIO_LEN } from '@/types/UserProfileExtended';
import TagInput from '@/components/TagInput';
import { fetchExtendedProfile, saveExtendedProfile } from '@/lib/firestoreExtendedProfile';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { showToast } from '@/utils/toast';
import { useNavigation } from '@react-navigation/native';

type Draft = Omit<UserProfileExtended, 'updatedAt'> & {
  bio: string;
  goals: string[];
  dreams: string[];
  beliefs: string[];
};

const DEFAULT_DRAFT: Draft = { bio: '', goals: [], dreams: [], beliefs: [] };

export default function ProfileExtendedForm({ showActions = false, autoSave = false, onDirtyChange, saveTick = 0 }: { showActions?: boolean; autoSave?: boolean; onDirtyChange?: (dirty: boolean) => void; saveTick?: number; }) {
  const { uid } = useAuth();
  const { user } = useUser();
  const isSubscribed = user?.isSubscribed === true;
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Draft>(DEFAULT_DRAFT);
  const [draft, setDraft] = useState<Draft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!uid || !isSubscribed) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        const data = (await fetchExtendedProfile(uid)) ?? {};
        const next: Draft = {
          bio: data.bio ?? '',
          goals: data.goals ?? [],
          dreams: data.dreams ?? [],
          beliefs: data.beliefs ?? [],
        };
        setSaved(next);
        setDraft(next);
      } catch (e) {
        console.warn('fetchExtendedProfile failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, isSubscribed]);

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const remaining = MAX_BIO_LEN - (draft.bio?.length ?? 0);

  async function doSave() {
    if (!uid) return;
    if (!isDirty) { showToast('Nothing to save'); return; }
    setSaving(true);
    try {
      await saveExtendedProfile(uid, draft);
      setSaved(draft);
      showToast('Saved');
    } catch (e) {
      console.warn('saveExtendedProfile failed', e);
      showToast('Error saving', 'Please try again');
    } finally {
      setSaving(false);
    }
  }

  // Optional autosave + dirty notifier
  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (!autoSave || !isDirty || !uid || !isSubscribed) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, uid, isSubscribed, isDirty, autoSave]);

  // Parent-triggered save
  useEffect(() => {
    if (!autoSave && isDirty) { void doSave(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTick]);

  function reset() { setDraft(saved); }

  if (!isSubscribed) {
    return (
      <View style={styles.upsell}>
        <Text style={styles.h1}>Unlock Extended Profile</Text>
        <Text style={styles.p}>
          Add goals, dreams, beliefs, and a bio. We’ll use these to tailor your ReligionAI and Journaling experience.
        </Text>
        <Pressable onPress={() => (navigation as any).navigate('Upgrade')} style={styles.cta}>
          <Text style={styles.ctaText}>Upgrade to OneVine+</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) return <ActivityIndicator />;

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Your Story</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={styles.textarea}
          value={draft.bio}
          onChangeText={(t) => t.length <= MAX_BIO_LEN && setDraft({ ...draft, bio: t })}
          placeholder="Tell us about you..."
          multiline
        />
        <Text style={styles.helper}>{remaining} characters left</Text>
      </View>

      <TagInput
        label="Goals"
        value={draft.goals ?? []}
        placeholder="Add a goal and press Enter"
        onChange={(goals) => setDraft({ ...draft, goals })}
      />

      <TagInput
        label="Dreams"
        value={draft.dreams ?? []}
        placeholder="Add a dream and press Enter"
        onChange={(dreams) => setDraft({ ...draft, dreams })}
      />

      <TagInput
        label="Beliefs"
        value={draft.beliefs ?? []}
        placeholder="Add a belief and press Enter"
        onChange={(beliefs) => setDraft({ ...draft, beliefs })}
      />

      {showActions && (
        <View style={styles.row}>
          <Pressable onPress={doSave} disabled={!isDirty || saving} style={[styles.btn, (!isDirty || saving) && styles.btnDisabled]}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, paddingVertical: 8 },
  h1: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  section: {},
  label: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  textarea: { minHeight: 120, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#333', textAlignVertical: 'top' },
  helper: { color: '#888', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { backgroundColor: '#F39C12', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'black', fontWeight: '700' },
  upsell: { paddingVertical: 8, gap: 8 },
  p: { color: '#aaa' },
  cta: { backgroundColor: '#F39C12', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, alignSelf: 'flex-start' },
  ctaText: { color: 'black', fontWeight: '700' },
});

