import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  TextInput,
  
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import Button from '@/components/common/Button';
import { useUser } from '@/hooks/useUser';
import { sendGeminiPrompt } from '@/services/geminiService';
import ScreenContainer from '@/components/theme/ScreenContainer';
import { useTheme } from '@/components/theme/theme';
import { ASK_GEMINI_SIMPLE } from '@/utils/constants';
import { setDocument } from '@/services/firestoreService';
import { loadUserProfile, incrementUserPoints, getUserAIPrompt } from '../../../utils';
import type { UserProfile } from '../../../types';
import { callFunction, awardPointsToUser } from '@/services/functionService';
import { ensureAuth } from '@/utils/authGuard';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/hooks/useAuth';

export default function TriviaScreen() {
  const theme = useTheme();
  const { authReady, uid } = useAuth();
  useEffect(() => {
    console.log('📚 Trivia screen opened');
  }, []);
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: theme.colors.text,
          marginBottom: 16,
          textAlign: 'center',
        }, // ✅ added missing 'title' style
        question: {
          fontSize: 16,
          marginBottom: 12,
          color: theme.colors.text,
        },
        input: {
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          backgroundColor: theme.colors.surface,
          color: theme.colors.text,
        },
        buttonWrap: { marginVertical: 8 },
        answer: { marginTop: 12, color: theme.colors.primary },
        story: {
          fontSize: 16,
          marginBottom: 12,
          color: theme.colors.text,
        }, // ✅ added missing 'story' style
      }),
    [theme],
  );
  const [story, setStory] = useState('');
  const [answer, setAnswer] = useState('');
  const [storyGuess, setStoryGuess] = useState('');
  const [correctReligion, setCorrectReligion] = useState('');
  const [correctStory, setCorrectStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      return;
    }
    fetchTrivia();
  }, [authReady, uid]);

  const { user } = useUser();

  const fetchTrivia = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;

    setLoading(true);
    setRevealed(false);
    setAnswer('');

    try {
      const profile = await loadUserProfile(uid);
      const religion = profile?.religion;
      const prefix = getUserAIPrompt();
      if (!uid || !religion) {
        console.warn('⚠️ askGemini blocked — missing uid or religion', { uid, religion });
        setLoading(false);
        return;
      }

      const data = await sendGeminiPrompt({
        url: ASK_GEMINI_SIMPLE,
        prompt: `${prefix} Give me a short moral story originally from any major world religion. Replace all real names and locations with fictional ones so that it seems to come from a different culture. Keep the meaning and lesson intact. After the story, add two lines: RELIGION: <religion> and STORY: <story name>.`.trim(),
        history: [],
        religion,
      });
      if (!data) {
        Alert.alert('Error', 'Could not load trivia. Please try again later.');
        return;
      }
      const [cleanStory, info] = data.split('\nRELIGION:');
      const [religionLine, storyLine] = info?.split('\nSTORY:') || [];

      setStory(cleanStory.trim());
      setCorrectReligion(religionLine?.trim() || '');
      setCorrectStory(storyLine?.trim() || '');
    } catch (err) {
      console.error('❌ Trivia fetch error:', err);
      Alert.alert('Error', 'Could not load trivia. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer && !storyGuess) return;

    const uid = await ensureAuth(user?.uid);
    if (!uid) return;

    setRevealed(true);

    const religionCorrect =
      correctReligion && answer.trim().toLowerCase() === correctReligion.toLowerCase();
    const storyCorrect =
      correctStory && storyGuess.trim().toLowerCase().includes(correctStory.toLowerCase());

    try {
      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const earned = (religionCorrect ? 1 : 0) + (storyCorrect ? 5 : 0);

      if (earned > 0) {
        await incrementUserPoints(earned, uid);

        await setDocument(`completedChallenges/${uid}`, {
          lastTrivia: new Date().toISOString(),
          triviaCompleted: true,
        });

        try {
          await awardPointsToUser(earned);
        } catch (err: any) {
          console.error('🔥 Backend error:', err.response?.data || err.message);
        }
      }

      const msg = `Religion guess ${religionCorrect ? 'correct' : 'wrong'}\n` +
        `Story guess ${storyCorrect ? 'correct' : 'wrong'}\n` +
        `Correct religion: ${correctReligion}\nCorrect story: ${correctStory}`;

      Alert.alert('Trivia Result', msg);
    } catch (err) {
      console.error('❌ Point update or challenge log failed:', err);
      Alert.alert('Error', 'Could not update your progress. Try again.');
    }
  };

  return (
    <AuthGate>
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.title}>Trivia Challenge</CustomText>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <CustomText style={styles.story}>{story}</CustomText>
        )}

        {!loading && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Guess the religion"
              value={answer}
              onChangeText={setAnswer}
            />
            <TextInput
              style={styles.input}
              placeholder="Guess the exact story"
              value={storyGuess}
              onChangeText={setStoryGuess}
            />
            <Button title="Submit Guess" onPress={submitAnswer} />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}

