import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { showGracefulError } from '@/utils/gracefulError';
import { ASK_GEMINI_SIMPLE } from "@/utils/constants";
import { getDocument, setDocument } from '@/services/firestoreService';
import { useUser } from '@/hooks/useUser';
import { getStoredToken } from '@/services/authService';
import { ensureAuth } from '@/utils/authGuard';
import { useChallengeStore } from '@/state/challengeStore';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/RootStackParamList';

export default function ChallengeScreen() {
  const theme = useTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: { paddingBottom: 64 },
        title: {
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 12,
          color: theme.colors.primary,
        },
        streak: { marginBottom: 8, color: theme.colors.text },
        challengeText: {
          fontSize: 16,
          marginBottom: 12,
          color: theme.colors.text,
        },
        challenge: {
          fontSize: 16,
          marginBottom: 12,
          color: theme.colors.text,
        }, // ✅ added missing 'challenge' style
        buttonWrap: { marginVertical: 8 },
      }),
    [theme],
  );
  const [challenge, setChallenge] = useState('');
  const [loading, setLoading] = useState(false);
  const [canSkip, setCanSkip] = useState(true);
  const streak = useChallengeStore((s) => s.streak);
  const incrementStreak = useChallengeStore((s) => s.incrementStreak);
  const syncStreak = useChallengeStore((s) => s.syncWithFirestore);
  const { user } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const checkMilestoneReward = async (current: number) => {
    const milestones = [3, 7, 14, 30];
    if (!milestones.includes(current)) return;
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;
    try {
      const userData = await getDocument(`users/${uid}`) || {};
      const granted = userData.streakMilestones || {};
      if (granted[current]) return;
      const reward = current >= 30 ? 10 : current >= 14 ? 7 : 5;
      const tokens = await getTokenCount();
      await setTokenCount(tokens + reward);
      await setDocument(`users/${uid}`, { [`streakMilestones.${current}`]: true });

      const idToken = await getStoredToken();
      const res = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          prompt: `Provide a short blessing for a user who reached a ${current}-day spiritual challenge streak in the ${userData.religion || 'Christian'} tradition.`,
        }),
      });
      const data = await res.json();
      const blessing = data.response || "You’ve walked with discipline and devotion. This is your blessing.";
      Alert.alert('Blessing!', `${blessing}\nYou earned ${reward} Grace Tokens.`);
    } catch (err) {
      console.error('❌ Milestone reward error:', err);
    }
  };

  const fetchChallenge = async () => {
    try {
      let idToken = await getStoredToken();
      const userId = await SecureStore.getItemAsync('userId');
      if (!idToken || !userId) {
        Alert.alert('Login Required', 'Please log in again.');
        navigation.replace('Login');
        return;
      }

      const uid = await ensureAuth(user?.uid);
      if (!uid) return;

      setLoading(true);

      const userData = await getDocument(`users/${uid}`) || {};
      const lastChallenge = userData.lastChallenge?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      if (lastChallenge && now.getTime() - lastChallenge.getTime() < oneDay) {
        setChallenge(userData.lastChallengeText || '');
        setCanSkip(false);
        setLoading(false);
        return;
      }

      const religion = userData.religion || 'spiritual';

      // Reuse the token instead of fetching it again
      idToken = idToken || (await getStoredToken());
      const response = await fetch(ASK_GEMINI_SIMPLE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          prompt: `Give me a short daily challenge for someone of the ${religion} faith.`,
        }),
      });

      const data = await response.json();
      const newChallenge = data.response || 'Reflect in silence for five minutes today.';
      setChallenge(newChallenge);

      await setDocument(`users/${uid}`, {
        lastChallenge: new Date().toISOString(),
        lastChallengeText: newChallenge,
      });
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      showGracefulError();
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

    const idToken = await getStoredToken();
    const userId = await SecureStore.getItemAsync('userId');
    if (!idToken || !userId) {
      Alert.alert('Login Required', 'Please log in again.');
      navigation.replace('Login');
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

    try {
      await setTokenCount(tokens - cost);
      setCanSkip(true);
      fetchChallenge();
    } catch (error: any) {
      console.error('🔥 API Error:', error?.response?.data || error.message);
      showGracefulError();
    }
  };

  const handleComplete = async () => {
    const uid = await ensureAuth(user?.uid);
    if (!uid) return;

    const newStreak = incrementStreak();

    const currentTokens = await getTokenCount();
    await setTokenCount(currentTokens + 1);
    await checkMilestoneReward(newStreak);

    const userData = await getDocument(`users/${uid}`) || {};
    await setDocument(`users/${uid}`, {
      individualPoints: (userData.individualPoints || 0) + 5,
    });

    if (userData.religion) {
      const relData = await getDocument(`religions/${userData.religion}`);
      await setDocument(`religions/${userData.religion}`, {
        totalPoints: (relData?.totalPoints || 0) + 5,
      });
    }

    if (userData.organizationId) {
      const orgData = await getDocument(`organizations/${userData.organizationId}`);
      await setDocument(`organizations/${userData.organizationId}`, {
        totalPoints: (orgData?.totalPoints || 0) + 5,
      });
    }

    Alert.alert('Great job!', 'Challenge completed.');
  };

  useEffect(() => {
    syncStreak();
    fetchChallenge();
  }, []);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Daily Challenge</Text>
        <Text style={styles.streak}>Streak: {streak} days</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <Text style={styles.challenge}>{challenge}</Text>
        )}
        <View style={styles.buttonWrap}>
          {canSkip && <Button title="Skip Challenge" onPress={handleSkip} />}
          <Button title="Mark Completed" onPress={handleComplete} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}


