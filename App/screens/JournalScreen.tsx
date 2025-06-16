import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { showGracefulError } from '@/utils/gracefulError';
import * as LocalAuthentication from 'expo-local-authentication';
import { queryCollection, addDocument, getDocument, setDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';
import { useUserDataStore } from '@/state/userDataStore';
import * as SecureStore from 'expo-secure-store';
import { getStoredToken } from '@/services/authService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';
import { getPromptsForReligion } from '@/utils/guidedPrompts';

export default function JournalScreen() {
  const theme = useTheme();
  const user = useUserDataStore((s) => s.userProfile);
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
  const [prompts, setPrompts] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<string[]>([]);
  const [guidedText, setGuidedText] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    async function authenticateAndLoad() {
      try {
        const idToken = await getStoredToken();
        const userId = await SecureStore.getItemAsync('userId');
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

        const list = await queryCollection(
          'journalEntries',
          'createdAt',
          'DESCENDING',
          { fieldPath: 'userId', op: 'EQUAL', value: uid }
        );
        setEntries(list);
        setReligion(user?.religion || '');
      } catch (err: any) {
        console.error('🔥 API Error:', err?.response?.data || err.message);
      } finally {
        setLoading(false);
      }
    }

    authenticateAndLoad();
  }, []);

  const startGuided = () => {
    const p = getPromptsForReligion(religion || '');
    setPrompts(p);
    setGuidedMode(true);
    setCurrentStep(0);
    setResponses([]);
    setGuidedText('');
  };

  const handleNextPrompt = () => {
    if (!guidedText.trim()) return;
    const updated = [...responses, guidedText.trim()];
    if (currentStep + 1 < prompts.length) {
      setResponses(updated);
      setGuidedText('');
      setCurrentStep(currentStep + 1);
    } else {
      const combined = prompts.map((q, i) => `${q}\n${updated[i]}`).join('\n\n');
      setEntry(combined);
      setResponses([]);
      setGuidedText('');
      setGuidedMode(false);
    }
  };

  const saveEntry = async () => {
    if (!entry.trim()) return;
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

      await addDocument('journalEntries', {
        userId: uid,
        content: entry,
        emotion: emotion || 'neutral',
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        challengeRef: userData.lastChallengeText || null,
        createdAt: new Date().toISOString(),
      });

      await setDocument(`users/${uid}`, {
        individualPoints: (userData.individualPoints || 0) + 2,
      });

      const religion = user?.religion;
      if (religion) {
        const relData = await getDocument(`religions/${religion}`);
        await setDocument(`religions/${religion}`, {
          totalPoints: (relData?.totalPoints || 0) + 2,
        });
      }

      if (user?.organizationId) {
        const orgData = await getDocument(`organizations/${user.organizationId}`);
        await setDocument(`organizations/${user.organizationId}`, {
          totalPoints: (orgData?.totalPoints || 0) + 2,
        });
      }

      Alert.alert('Saved!', 'Your reflection has been saved.');
      setEntry('');
      setEmotion('');
      setTags('');

      const list = await queryCollection('journalEntries', 'createdAt', 'DESCENDING', { fieldPath: 'userId', op: 'EQUAL', value: uid });
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
            <Text style={styles.prompt}>
              Today’s Prompt:{' '}
              <Text style={styles.promptBold}>What’s on your heart this morning?</Text>
            </Text>

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

            <Button title={saving ? 'Saving…' : 'Save Entry'} onPress={saveEntry} disabled={saving} />
            <Button title="Start Guided Journal" onPress={startGuided} />
          </>
        ) : (
          <>
            <Text style={styles.prompt}>{prompts[currentStep]}</Text>
            <Text style={styles.promptBold}>{`${currentStep + 1} of ${prompts.length}`}</Text>
            <TextInput
              style={styles.input}
              multiline
              placeholder="Your response…"
              placeholderTextColor={theme.colors.fadedText}
              value={guidedText}
              onChangeText={setGuidedText}
            />
            <Button
              title={currentStep + 1 === prompts.length ? 'Finish' : 'Next'}
              onPress={handleNextPrompt}
            />
          </>
        )}

        <Text style={styles.sectionTitle}>Past Reflections</Text>
        {entries.length === 0 && (
          <Text style={styles.emptyText}>No journal entries yet.</Text>
        )}
        {entries.map((e) => (
          <Pressable key={e.id} onPress={() => openEntry(e)}>
            <View style={styles.entryItem}>
              <Text style={styles.entryDate}>
                {e.createdAt?.toDate
                  ? e.createdAt.toDate().toLocaleString()
                  : '(no date)'}
              </Text>
              <Text style={styles.entryText}>
                {e.content.length > 100 ? e.content.slice(0, 100) + '…' : e.content}
              </Text>
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
            <Text style={styles.modalTitle}>
              {selectedEntry?.createdAt?.toDate
                ? selectedEntry.createdAt.toDate().toLocaleString()
                : '(no date)'}
            </Text>
            <ScrollView>
              <Text style={styles.modalText}>{selectedEntry?.content}</Text>
            </ScrollView>
            <Button title="Close" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}


