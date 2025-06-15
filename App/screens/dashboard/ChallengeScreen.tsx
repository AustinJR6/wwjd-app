import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { theme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { firestore } from '@/config/firebase';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';

export default function ChallengeScreen() {
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(false);
  const [canSkip, setCanSkip] = useState(true);
  const { user } = useUser();

  const fetchChallenge = async () => {
    try {
      if (!user) return;

      setLoading(true);

      const userRef = doc(collection(firestore, 'users'), user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      const lastChallenge = userData.lastChallenge?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      if (lastChallenge && now.getTime() - lastChallenge.getTime() < oneDay) {
        setChallenge(userData.lastChallengeText || '');
        setCanSkip(false);
        setLoading(false);
        return;
      }

      const idToken = await getStoredToken();
      const response = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: 'Give me a daily spiritual or moral challenge for self-reflection.',
        }),
      });

      const data = await response.json();
      const newChallenge = data.response || 'Reflect in silence for five minutes today.';
      setChallenge(newChallenge);

      await setDoc(
        userRef,
        {
          lastChallenge: new Date(), // ✅ replaces serverTimestamp()
          lastChallengeText: newChallenge,
        },
        { merge: true }
      );
    } catch (err) {
      console.error('❌ Challenge fetch error:', err);
      Alert.alert('Error', 'Could not load challenge. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    const cost = 3;
    const tokens = await getTokenCount();
    if (tokens < cost) {
      Alert.alert('Not Enough Tokens', `You need ${cost} tokens to skip.`);
      return;
    }

    const confirmed = await new Promise((resolve) => {
      Alert.alert(
        `Use ${cost} Tokens to Skip?`,
        'Are you sure you want to skip the current challenge?',
        [
          { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Yes', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    await setTokenCount(tokens - cost);
    setCanSkip(true);
    fetchChallenge();
  };

  useEffect(() => {
    fetchChallenge();
  }, []);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Daily Challenge</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Text style={styles.challenge}>{challenge}</Text>
        )}
        <View style={styles.buttonWrap}>
          {canSkip && <Button title="Skip Challenge" onPress={handleSkip} />}
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
    marginBottom: 16,
  },
  challenge: {
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonWrap: {
    marginTop: 20,
  },
});

