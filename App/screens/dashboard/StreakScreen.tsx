import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { theme } from "@/components/theme/theme";
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { getDocument, setDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import { ensureAuth } from '@/utils/authGuard';

export default function StreakScreen() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const { user } = useUser();

  useEffect(() => {
    fetchStreakMessage();
  }, []);

  const fetchStreakMessage = async () => {
    try {
      const uid = await ensureAuth(user?.uid);
      if (!uid) return;

      setLoading(true);

      const streakData = await getDocument(`completedChallenges/${uid}`);

      const today = new Date().toDateString();

      if (streakData?.lastStreakMessageDate === today && streakData?.message) {
        setMessage(streakData.message);
        setStreak(streakData.streakCount || 0);
        setLoading(false);
        return;
      }

      const userData = await getDocument(`users/${uid}`) || {};
      const religion = userData.religion || 'Spiritual Guide';
      const role = religion === 'Christianity' ? 'Pastor' :
                   religion === 'Islam' ? 'Imam' :
                   religion === 'Hinduism' ? 'Guru' :
                   religion === 'Buddhism' ? 'Teacher' :
                   religion === 'Judaism' ? 'Rabbi' :
                   'Spiritual Guide';

      const idToken = await getStoredToken();

      const response = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: `The user has completed ${streakData?.streakCount || 0} daily challenges in a row. Give them a short motivational message from a ${role} encouraging continued devotion.`,
        }),
      });

      const data = await response.json();
      const messageText = data?.response || 'You are walking faithfully. Keep your eyes on Me.';

      setMessage(messageText);
      setStreak(streakData?.streakCount || 0);

      await setDocument(`completedChallenges/${uid}`, {
        lastStreakMessageDate: today,
        message: messageText,
        streakCount: streakData?.streakCount || 0,
      });
    } catch (err) {
      console.error('?? Streak message fetch error:', err);
      Alert.alert('Error', 'Could not load your encouragement. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Your Current Streak</Text>
        <Text style={styles.streak}>{streak} Days ??</Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Text style={styles.message}>{message}</Text>
        )}

        <View style={styles.buttonWrap}>
          <Button title="Refresh Message" onPress={fetchStreakMessage} />
        </View>
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
    marginBottom: 12,
  },
  streak: {
    fontSize: 20,
    color: theme.colors.accent,
    marginBottom: 20,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 16,
    color: theme.colors.text,
  },
  buttonWrap: {
    marginTop: 16,
    width: '100%',
  },
});

