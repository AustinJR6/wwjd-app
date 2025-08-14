import React, { useState, useEffect } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { showGracefulError } from '@/utils/gracefulError';
import * as LocalAuthentication from 'expo-local-authentication';
import { querySubcollection, addDocument, getDocument, setDocument } from '@/services/firestoreService';

import { loadUserProfile, incrementUserPoints, getUserAIPrompt } from '@/utils/userProfile';
import type { UserProfile } from '../../types/profile';

import { callFunction, awardPointsToUser } from '@/services/functionService';
import { ASK_GEMINI_SIMPLE } from '@/utils/constants';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { sendGeminiPrompt } from '@/services/geminiService';
import { getReligionById } from '@/lib/firestoreRest';
import { useAuth } from '@/hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import AuthGate from '@/components/AuthGate';
import { Picker } from '@react-native-picker/picker';
import { JOURNAL_STAGES, JOURNAL_PROMPTS } from '@/utils/journalStages';
import type { JournalStage } from '@/types';

export default function JournalScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingBottom: 64,
        },
        prompt: {
          fontSize: 18,
          marginBottom: 12,
          color: theme.colors.text,
        },
        promptBold: {
          fontWeight: '600',
          color: theme.colors.primary,
        },
        input: {
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: 8,
          padding: 12,
          textAlignVertical: 'top',
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
          marginBottom: 16,
          minHeight: 120,
        },
        center: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: 'bold',
          marginTop: 24,
          marginBottom: 12,
          color: theme.colors.text,
        },
        entryItem: {
          marginBottom: 12,
          padding: 12,
          backgroundColor: theme.colors.surface,
          borderRadius: 8,
        },
        emptyText: {
          textAlign: 'center',
          color: theme.colors.fadedText,
          marginBottom: 12,
        },
        entryDate: {
          fontSize: 14,
          fontWeight: 'bold',
          color: theme.colors.fadedText,
          marginBottom: 4,
        },
        entryText: {
          fontSize: 16,
          color: theme.colors.text,
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          padding: 24,
        },
        modalContent: {
          backgroundColor: theme.colors.surface,
          padding: 20,
          borderRadius: 12,
          maxHeight: '80%',
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 12,
          textAlign: 'center',
          color: theme.colors.primary,
        },
        modalText: {
          fontSize: 16,
          color: theme.colors.text,
          marginBottom: 16,
        },
      }),
    [theme],
  );
  const [entry, setEntry] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [lastTimestamp, setLastTimestamp] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [emotion, setEmotion] = useState('');
  const [tags, setTags] = useState('');
  const [religionId, setReligionId] = useState('');
  const [guidedMode, setGuidedMode] = useState(false);
  const [stage, setStage] = useState<JournalStage>('reflection');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (!authReady || !uid) return;
    async function authenticateAndLoad() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (hasHardware && isEnrolled) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock your journal',
          });
          if (!result.success) {
            Alert.alert('Authentication failed', 'Cannot access journal.');
            return;
          }
        }

        const uid = await ensureAuth(await getCurrentUserId());

        console.log('Firebase currentUser:', await getCurrentUserId());
        const tokenPreview = await getToken(true);
        console.log('ID Token:', tokenPreview);

        await fetchEntries(true, uid);
        const userData = await loadUserProfile(uid);
        setReligionId(userData?.religionId || userData?.religion || 'spiritual');
      } catch (err: any) {
        console.error('🔥 API Error:', err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    }

    authenticateAndLoad();
  }, [authReady, uid]);

  const fetchEntries = async (reset = false, forcedUid?: string) => {
    const storedUid = forcedUid || (await ensureAuth(await getCurrentUserId()));
    if (!storedUid) return;
    if (reset) {
      setLastTimestamp(null);
      setHasMore(true);
    }
    if (!hasMore && !reset) return;
    setLoadingMore(true);
    const page = await querySubcollection(
      `journalEntries/${storedUid}`,
      'entries',
      'timestamp',
      'DESCENDING',
      20,
      reset ? undefined : lastTimestamp || undefined,
    );
    const newEntries = reset ? page : [...entries, ...page];
    setEntries(newEntries);
    setLastTimestamp(page.length ? page[page.length - 1].timestamp : lastTimestamp);
    setHasMore(page.length === 20);
    setLoadingMore(false);
  };

  const handleGuidedJournal = async () => {
    console.log('🔮 Start Guided Journal Pressed');
    const prompt = JOURNAL_PROMPTS[stage];
    setAiPrompt(prompt);
    setGuidedMode(true);
    try {
      const uid = await ensureAuth(await getCurrentUserId());
      console.log('Firebase currentUser:', await getCurrentUserId());
      const token = await getToken(true);
      console.log('ID Token:', token);
      if (!uid || !religionId) {
        console.warn('⚠️ askGemini blocked — missing uid or religion', { uid, religionId });
        return;
      }
      const religionDoc = await getReligionById(religionId);
      const prefix = `${getUserAIPrompt()} ${religionDoc?.prompt || ''}`.trim();
      const answer = await sendGeminiPrompt({
        url: ASK_GEMINI_SIMPLE,
        prompt: `${prefix} ${prompt}`.trim(),
        history: [],
        token: token || undefined,
        religion: religionDoc?.id || religionId,
      });
      if (!answer) {
        Alert.alert('Guide Unavailable', 'We couldn\u2019t reach our guide right now. Write freely from the heart.');
        setAiResponse('');
        return;
      }
      setAiResponse(answer);
      console.log('🎉 Gus Bug: Gemini text received.');
    } catch (err) {
      console.error('❌ Guided journal error:', err);
      Alert.alert('Guide Unavailable', 'We couldn\u2019t reach our guide right now. Write freely from the heart.');
      setAiResponse('');
    }
  };

  const handleSaveEntry = async () => {
    console.log("📝 Save Entry Pressed");
    // allow saving in guided mode directly
    if (!entry.trim()) {
      Alert.alert('Empty Entry', 'Please write something before saving.');
      return;
    }
    setSaving(true);
    try {
      const uid = await ensureAuth(await getCurrentUserId());

      console.log('Firebase currentUser:', await getCurrentUserId());
      const token = await getToken(true);
      const tokenPreview = token ? token.slice(0, 8) : 'none';
      console.log('ID Token:', tokenPreview);

      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);

      console.log(`📝 Attempting to save journal entry for UID ${uid}`);
      const path = `journalEntries/${uid}/entries`;
      await addDocument(path, {
        stage,
        aiPrompt,
        aiResponse,
        userEntry: entry,
        timestamp: new Date().toISOString(),
      });
      console.log('✅ Journal entry saved');

      await incrementUserPoints(2, uid);

      try {
        await callFunction('updateStreakAndXP', { type: 'journal' });
      } catch (err: any) {
        if (err?.response?.status === 401) {
          console.warn('Journal streak update unauthorized');
        } else {
          console.error('Streak update failed:', err);
        }
      }

      try {
        await awardPointsToUser(2);
      } catch (err: any) {
        console.error('🔥 Backend error:', err.response?.data || err.message);
      }

      Alert.alert('✅ Journal Saved', 'Your reflection has been securely stored.');
      console.log('🎉 Gus Bug: Journal entry saved.');
      setEntry('');
      setEmotion('');
      setTags('');

      await fetchEntries(true, uid);
    } catch (err: any) {
      console.error('❌ Journal save error:', {
        path: `journalEntries/${uid}/entries`,
        uid,
        token: (await getToken(true))?.slice(0, 8) || 'none',
        error: err?.response?.data || err.message,
      });
      showGracefulError();
    } finally {
      setSaving(false);
    }
  };

  const openEntry = (entry: any) => {
    setSelectedEntry(entry);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthGate>
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {!guidedMode ? (
          <>
            <CustomText style={styles.prompt}>Journal Stage</CustomText>
            <View style={{ borderColor: theme.colors.border, borderWidth: 1, borderRadius: 8, marginBottom: 16 }}>
              <Picker
                selectedValue={stage}
                onValueChange={(v) => setStage(v as JournalStage)}
              >
                {JOURNAL_STAGES.map((s) => (
                  <Picker.Item key={s.key} label={s.label} value={s.key} />
                ))}
              </Picker>
            </View>
            <CustomText style={styles.prompt}>Today’s Prompt:</CustomText>
            <CustomText style={styles.promptBold}>What’s on your heart this morning?</CustomText>

            <TextInput
              style={styles.input}
              multiline
              placeholder="Write your reflection here…"
              placeholderTextColor={theme.colors.fadedText}
              value={entry}
              onChangeText={setEntry}
            />
            <TextInput
              style={styles.input}
              placeholder="Emotion (optional)"
              placeholderTextColor={theme.colors.fadedText}
              value={emotion}
              onChangeText={setEmotion}
            />
            <TextInput
              style={styles.input}
              placeholder="Tags (comma separated)"
              placeholderTextColor={theme.colors.fadedText}
              value={tags}
              onChangeText={setTags}
            />

            <Button
              title={saving ? 'Saving…' : 'Save Entry'}
              onPress={handleSaveEntry}
              disabled={saving || guidedMode}
            />
            <Button title="Start Guided Journal" onPress={handleGuidedJournal} />
          </>
        ) : (
          <>
            {aiResponse ? (
              <CustomText style={styles.prompt}>{aiResponse}</CustomText>
            ) : null}
            <TextInput
              style={styles.input}
              multiline
              placeholder="Write your reflection…"
              placeholderTextColor={theme.colors.fadedText}
              value={entry}
              onChangeText={setEntry}
            />
            <Button
              title={saving ? 'Saving…' : 'Save Entry'}
              onPress={handleSaveEntry}
              disabled={saving}
            />
            <Button title="Cancel" onPress={() => { setGuidedMode(false); setAiResponse(''); }} />
          </>
        )}

        <CustomText style={styles.sectionTitle}>Past Reflections</CustomText>
        {entries.length === 0 && (
          <CustomText style={styles.emptyText}>No journal entries yet.</CustomText>
        )}
        {entries.map((e) => (
          <Pressable key={e.id} onPress={() => openEntry(e)}>
            <View style={styles.entryItem}>
              <CustomText style={styles.entryDate}>
                {e.timestamp?.toDate
                  ? e.timestamp.toDate().toLocaleString()
                  : '(no date)'}
              </CustomText>
              <CustomText style={styles.entryText}>
                {e.userEntry.length > 100 ? e.userEntry.slice(0, 100) + '…' : e.userEntry}
              </CustomText>
            </View>
          </Pressable>
        ))}
        {loadingMore && <ActivityIndicator style={{ marginVertical: 12 }} />}
        {!loadingMore && hasMore && (
          <Button title="Load More" onPress={() => fetchEntries(false)} />
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <CustomText style={styles.modalTitle}>
              {selectedEntry?.timestamp?.toDate
                ? selectedEntry.timestamp.toDate().toLocaleString()
                : '(no date)'}
            </CustomText>
            <ScrollView>
              <CustomText style={styles.modalText}>{selectedEntry?.userEntry}</CustomText>
            </ScrollView>
            <Button title="Close" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
    </AuthGate>
  );
}


