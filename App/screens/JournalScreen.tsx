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
import { callFunction, incrementReligionPoints } from '@/services/functionService';
import { ASK_GEMINI_SIMPLE } from '@/utils/constants';
import { ensureAuth } from '@/utils/authGuard';
import * as SafeStore from '@/utils/secureStore';
import { getStoredToken } from '@/services/authService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { Picker } from '@react-native-picker/picker';
import { JOURNAL_STAGES, JOURNAL_PROMPTS } from '@/utils/journalStages';
import type { JournalStage } from '@/types';

export default function JournalScreen() {
  const theme = useTheme();
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [emotion, setEmotion] = useState('');
  const [tags, setTags] = useState('');
  const [religion, setReligion] = useState('');
  const [guidedMode, setGuidedMode] = useState(false);
  const [stage, setStage] = useState<JournalStage>('reflection');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    async function authenticateAndLoad() {
      try {
        const idToken = await getStoredToken();
        const userId = await SafeStore.getItem('userId');
        if (!idToken || !userId) {
          Alert.alert('Login Required', 'Please log in again.');
          navigation.replace('Login');
          return;
        }
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

        const uid = await ensureAuth();
        if (!uid) {
          Alert.alert('Login Required', 'Please log in again.');
          navigation.replace('Login');
          return;
        }

        const list = await querySubcollection(
          `users/${uid}`,
          'journalEntries',
          'timestamp',
          'DESCENDING'
        );
        setEntries(list);
        const userData = await getDocument(`users/${uid}`);
        setReligion(userData?.religion || '');
      } catch (err: any) {
        console.error('🔥 API Error:', err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    }

    authenticateAndLoad();
  }, []);

  const handleGuidedJournal = async () => {
    console.log('🔮 Start Guided Journal Pressed');
    const prompt = JOURNAL_PROMPTS[stage];
    setAiPrompt(prompt);
    setGuidedMode(true);
    try {
      const idToken = await getStoredToken();
      const uid = await ensureAuth();
      if (!idToken || !uid) throw new Error('auth');
      const res = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ prompt, history: [] }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Invalid JSON from guided journal:', text);
        Alert.alert('Guide Unavailable', 'We couldn\u2019t reach our guide right now. Write freely from the heart.');
        setAiResponse('');
        return;
      }
      setAiResponse(data.response || '');
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
      const idToken = await getStoredToken();
      const uid = await ensureAuth();
      if (!idToken || !uid) {
        Alert.alert('Login Required', 'Please log in again.');
        navigation.replace('Login');
        return;
      }

      const userData = await getDocument(`users/${uid}`) || {};

      console.log('📤 Saving journal entry for UID:', uid);
      await addDocument(`users/${uid}/journalEntries`, {
        stage,
        aiPrompt,
        aiResponse,
        userEntry: entry,
        timestamp: new Date().toISOString(),
      });

      await setDocument(`users/${uid}`, {
        individualPoints: (userData.individualPoints || 0) + 2,
      });

      try {
        await callFunction('updateStreakAndXP', { type: 'journal' });
      } catch (err) {
        console.error('Streak update failed:', err);
      }

      if (userData.religion) {
        try {
          await incrementReligionPoints(userData.religion, 2);
        } catch (err: any) {
          console.error('🔥 Backend error:', err.response?.data || err.message);
        }
      }

      if (userData.organizationId) {
        const orgData = await getDocument(`organizations/${userData.organizationId}`);
        const newTotal = (orgData?.totalPoints || 0) + 2;
        await setDocument(`organizations/${userData.organizationId}`, {
          totalPoints: newTotal,
        });
        console.log(`🏛️ Added points to org ${userData.organizationId}:`, newTotal);
      }

      Alert.alert('✅ Journal Saved', 'Your reflection has been securely stored.');
      console.log('🎉 Gus Bug: Journal entry saved.');
      setEntry('');
      setEmotion('');
      setTags('');

      const list = await querySubcollection(
        `users/${uid}`,
        'journalEntries',
        'timestamp',
        'DESCENDING'
      );
      setEntries(list);
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
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
  );
}


