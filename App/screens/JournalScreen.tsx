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
  Button,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScreenContainer from '../components/theme/ScreenContainer.tsx';
import { theme } from '../components/theme/theme.ts';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  getDocs,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import * as LocalAuthentication from 'expo-local-authentication';

export default function JournalScreen() {
  const [entry, setEntry] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

  useEffect(() => {
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

        const { db } = await import('../config/firebaseConfig.ts');

        const q = query(collection(db, 'journalEntries'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setEntries(list);
      } catch (err) {
        console.error('Error loading journal entries:', err);
      } finally {
        setLoading(false);
      }
    }

    authenticateAndLoad();
  }, []);

  const saveEntry = async () => {
    if (!entry.trim()) return;
    setSaving(true);
    try {
      const { db } = await import('../config/firebaseConfig.ts');

      await addDoc(collection(db, 'journalEntries'), {
        text: entry,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Saved!', 'Your reflection has been saved.');
      setEntry('');

      const q = query(collection(db, 'journalEntries'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setEntries(list);
    } catch (err) {
      console.error('Error saving entry:', err);
      Alert.alert('Error', 'Could not save entry.');
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

        <Button title={saving ? 'Saving…' : 'Save Entry'} onPress={saveEntry} disabled={saving} />

        <Text style={styles.sectionTitle}>Past Reflections</Text>
        {entries.map((e) => (
          <Pressable key={e.id} onPress={() => openEntry(e)}>
            <View style={styles.entryItem}>
              <Text style={styles.entryDate}>
                {e.createdAt?.toDate ? e.createdAt.toDate().toLocaleString() : '(no date)'}
              </Text>
              <Text style={styles.entryText}>
                {e.text.length > 100 ? e.text.slice(0, 100) + '…' : e.text}
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
              <Text style={styles.modalText}>{selectedEntry?.text}</Text>
            </ScrollView>
            <Button title="Close" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
