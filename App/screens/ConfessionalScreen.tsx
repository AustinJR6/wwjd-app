import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import Button from '@/components/common/Button';
import { theme } from "@/components/theme/theme";
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { getDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import { ensureAuth } from '@/utils/authGuard';

export default function ConfessionalScreen() {
  const [confession, setConfession] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useUser();

  const handleConfess = async () => {
    if (!confession.trim()) {
      Alert.alert('Please enter your confession.');
      return;
    }

    setLoading(true);
    try {
      const uid = await ensureAuth(user?.uid);
      if (!uid) {
        setLoading(false);
        return;
      }

      const userData = await getDocument(`users/${uid}`);
      const religion = userData.religion || 'Spiritual Guide';
      const role = religion === 'Christianity' ? 'Pastor' :
                   religion === 'Islam' ? 'Imam' :
                   religion === 'Hinduism' ? 'Guru' :
                   religion === 'Buddhism' ? 'Teacher' :
                   religion === 'Judaism' ? 'Rabbi' :
                   'Spiritual Guide';

      const idToken = await getStoredToken();
      const res = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: `User confession: ${confession}\n${role}:`,
        }),
      });

      const data = await res.json();
      const answer = data.response || 'You are forgiven. Walk in peace.';
      setResponse(answer);
    } catch (err) {
      console.error('❌ Confession error:', err);
      Alert.alert('Error', 'Could not process your confession. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Confessional</Text>
        <TextInput
          style={styles.input}
          placeholder="What's on your heart?"
          value={confession}
          onChangeText={setConfession}
          multiline
        />
        <View style={styles.buttonWrap}>
          <Button title="Confess" onPress={handleConfess} disabled={loading} />
        </View>
        {loading && <ActivityIndicator size="large" color={theme.colors.primary} />}
        {response && <Text style={styles.response}>{response}</Text>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    minHeight: 100,
    marginBottom: 16,
    textAlignVertical: 'top',
    backgroundColor: theme.colors.surface,
  },
  buttonWrap: {
    marginVertical: 12,
    width: '100%',
  },
  response: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'left',
    width: '100%',
  },
});

