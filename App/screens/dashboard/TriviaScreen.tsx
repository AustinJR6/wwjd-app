import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import Button from '@/components/common/Button';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { theme } from '@/components/theme/theme';
import { ASK_GEMINI_SIMPLE } from '@/utils/constants';
import { getDocument, setDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export default function TriviaScreen() {
  const [story, setStory] = useState('');
  const [answer, setAnswer] = useState('');
  const [correctReligion, setCorrectReligion] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetchTrivia();
  }, []);

  const { user } = useUser();

  const fetchTrivia = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;

    setLoading(true);
    setRevealed(false);
    setAnswer('');

    try {
      const idToken = await getStoredToken();
      const response = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          prompt: `Give me a short moral story originally from any major world religion. Replace all real names and locations with fictional ones so that it seems to come from a different culture or context. Keep the meaning and lesson of the story intact. At the end, include a line that says REVEAL: followed by the actual religion.`
        })
      });

      const data = await response.json();
      const [cleanStory, religion] = data.response.split('\nREVEAL:');

      setStory(cleanStory.trim());
      setCorrectReligion(religion?.trim());
    } catch (err) {
      console.error('❌ Trivia fetch error:', err);
      Alert.alert('Error', 'Could not load trivia. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer) return;

    const uid = await ensureAuth(user?.uid);
    if (!uid) return;

    setRevealed(true);

    const isCorrect =
      correctReligion && answer.toLowerCase().includes(correctReligion.toLowerCase());

    try {
      const userData = await getDocument(`users/${uid}`) || {};

      if (isCorrect) {
        await setDocument(`users/${uid}`, {
          individualPoints: (userData.individualPoints || 0) + 10,
        });

        await setDocument(`completedChallenges/${uid}`, {
          lastTrivia: new Date().toISOString(),
          triviaCompleted: true,
        });
      }

      Alert.alert(
        isCorrect ? 'Correct!' : 'Not quite',
        `The story was from: ${correctReligion}`
      );
    } catch (err) {
      console.error('❌ Point update or challenge log failed:', err);
      Alert.alert('Error', 'Could not update your progress. Try again.');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Trivia Challenge</Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Text style={styles.story}>{story}</Text>
        )}

        {!loading && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Guess the religion"
              value={answer}
              onChangeText={setAnswer}
            />
            <Button title="Submit Guess" onPress={submitAnswer} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    justifyContent: 'center'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 16,
    textAlign: 'center'
  },
  story: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 16
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text
  }
});
