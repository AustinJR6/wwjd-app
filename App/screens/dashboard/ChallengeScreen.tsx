import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
  ToastAndroid,
  Platform,
} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { showGracefulError } from '@/utils/gracefulError';
import { ASK_GEMINI_SIMPLE, GENERATE_CHALLENGE_URL } from "@/utils/constants";
import {
  getOrCreateActiveChallenge,
  updateActiveChallenge,
  deleteDocument,
} from '@/services/firestoreService';
import { loadUserProfile, updateUserProfile, getUserAIPrompt } from '@/utils/userProfile';
import { canLoadNewChallenge } from '@/services/challengeLimitService';
import { completeChallengeWithStreakCheck } from '@/services/challengeStreakService';
import { createMultiDayChallenge, completeChallengeDay } from '@/services/functionService';
import { ensureAuth } from '@/utils/authGuard';
import { getCurrentUserId, getTokenCount, setTokenCount } from '@/utils/TokenManager';
import { useAuth } from '@/hooks/useAuth';
import { sendGeminiPrompt } from '@/services/geminiService';
import AuthGate from '@/components/AuthGate';
import { UserProfile } from '../../../types';

const showToast = (msg: string) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg);
  }
};
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
  const [activeMulti, setActiveMulti] = useState<any | null>(null);
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canSkip, setCanSkip] = useState(true);
  const [streakCount, setStreakCount] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState<Date | null>(null);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const { authReady, uid } = useAuth();

  const checkMilestoneReward = async (current: number) => {
    const milestones = [3, 7, 14, 30];
    if (!milestones.includes(current)) return;
    const uid = await ensureAuth(await getCurrentUserId());
    try {
      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const granted = profile.streakMilestones || {};
      const key = `m${current}`;
      if (granted[key]) return;
      const reward = current >= 30 ? 10 : current >= 14 ? 7 : 5;
      const tokens = await getTokenCount();
      await setTokenCount(tokens + reward);
      await updateUserProfile({
        streakMilestones: { ...granted, [key]: true },
      }, uid);

      const religion = profile?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ Challenge generation blocked — missing uid or religion', {
          uid,
          religion,
        });
        return;
      }

      const prefix = getUserAIPrompt();
      const blessing = await sendGeminiPrompt({
        url: ASK_GEMINI_SIMPLE,
        prompt: `${prefix} Provide a short blessing for a user who reached a ${current}-day spiritual challenge streak in the ${religion} tradition.`.trim(),
        history: [],
        religion,
      });
      if (blessing) {
        Alert.alert('Blessing!', `${blessing}\nYou earned ${reward} Grace Tokens.`);
      } else {
        Alert.alert('Blessing!', `You earned ${reward} Grace Tokens.`);
      }
    } catch (err) {
      console.error('❌ Milestone reward error:', err);
    }
  };

  const loadChallengeStreak = async () => {
    const uid = await ensureAuth(await getCurrentUserId());
    if (!uid) return;
    const data = await loadUserProfile(uid);
    const streakData = data?.challengeStreak || {};
    setStreakCount(streakData.count || 0);
    setLastCompletedDate(streakData.lastCompletedDate ? new Date(streakData.lastCompletedDate) : null);
  };

  const fetchChallenge = async (forceNew = false) => {
    try {

      const uid = await ensureAuth(await getCurrentUserId());

      let active = await getOrCreateActiveChallenge(uid);
      if (active && !active.isComplete) {
        if (active.isMultiDay === true) {
          setActiveMulti(active);
          setChallenge('');
          setChallengeAccepted(true);
          setLoading(false);
          return;
        }
        if (active.challengeText && active.challengeText.trim()) {
          setChallenge(active.challengeText);
          setChallengeAccepted(true);
          setActiveMulti(null);
          setLoading(false);
          return;
        }
      } else {
        setActiveMulti(null);
      }

      setChallengeAccepted(false);

      setLoading(true);

      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const lastChallenge = profile.lastChallenge ? new Date(profile.lastChallenge) : null;
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      if (!forceNew && lastChallenge && now.getTime() - lastChallenge.getTime() < oneDay) {
        setChallenge(profile.lastChallengeText || '');
        setCanSkip(false);
        setLoading(false);
        return;
      }

      const allowed = await canLoadNewChallenge();
      if (!allowed) {
        setLoading(false);
        return;
      }

      const religion = profile?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ Challenge generation blocked — missing uid or religion', { uid, religion });
        setLoading(false);
        return;
      }

      const prompt =
        `Give me a short daily challenge for the ${religion} faith on ${new Date().toDateString()}.`;
      console.log('📡 Sending Gemini prompt:', prompt);
      console.log('👤 Role:', religion);

      console.log('Current user:', await getCurrentUserId());
      const debugToken = await getToken(true);
      console.log('ID Token:', debugToken);

      const prefix = getUserAIPrompt();
      let newChallenge = await sendGeminiPrompt({
        url: GENERATE_CHALLENGE_URL,
        prompt: `${prefix} ${prompt}`.trim(),
        history: [],
        token: debugToken || undefined,
        religion,
      });
      if (!newChallenge || typeof newChallenge !== 'string' || newChallenge.trim().length === 0) {
        newChallenge = 'Take a mindful breath and pause for one minute.';
      } else {
        console.log('🌟 New Challenge:', newChallenge);
      }
      setChallenge(newChallenge.trim());
      setChallengeAccepted(false);
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      showGracefulError('Unable to load challenge data — please try again later');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipChallenge = async () => {
    const uid = await ensureAuth(await getCurrentUserId());

    const active = await getOrCreateActiveChallenge(uid);

    const userData: UserProfile | null = await loadUserProfile(uid);
    const profile = userData ?? ({} as UserProfile);
    const today = new Date().toISOString().split('T')[0];
    const historyArr = Array.isArray(profile.dailyChallengeHistory)
      ? [...profile.dailyChallengeHistory]
      : [];
    let todayEntry = historyArr.find((h) => h.date === today);
    if (!todayEntry) {
      todayEntry = { date: today, completed: 0, skipped: 0 };
      historyArr.push(todayEntry);
    }

    const tokens = profile?.tokens ?? 0;
    let dailySkipCount = profile?.dailySkipCount ?? 0;
    const lastSkipDate = profile?.lastSkipDate;
    const lastDate = lastSkipDate ? new Date(lastSkipDate).toISOString().split('T')[0] : '';

    if (lastDate !== today) {
      dailySkipCount = 0;
    }

    const skipCost = Math.pow(2, dailySkipCount);

    if (tokens < skipCost) {
      Alert.alert('Not enough tokens', `You need ${skipCost} tokens to skip this challenge.`);
      return;
    }

    try {
      todayEntry.skipped += 1;
      await updateUserProfile(
        {
          tokens: tokens - skipCost,
          dailySkipCount: dailySkipCount + 1,
          lastSkipDate: new Date().toISOString(),
          skipTokensUsed: (profile.skipTokensUsed || 0) + skipCost,
          dailyChallengeHistory: historyArr,
        },
        uid,
      );
      await updateActiveChallenge(uid, {
        isComplete: true,
        lastCompleted: new Date().toISOString(),
        completedDays: [...(active.completedDays || []), active.currentDay],
      });
      setCanSkip(true);
      fetchChallenge(true);
    } catch (error: any) {
      console.error('🔥 API Error:', error?.response?.data || error.message);
      showGracefulError('Unable to load challenge data — please try again later');
    }
  };

  const handleStartMultiDay = async () => {
    const uid = await ensureAuth(await getCurrentUserId());

    try {
      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const religion = profile?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ Challenge generation blocked — missing uid or religion', { uid, religion });
        return;
      }
      await createMultiDayChallenge('Provide a 3-day gratitude challenge.', 3, religion);
      fetchChallenge(true);
    } catch (err) {
      console.error('Failed to start multi-day challenge:', err);
      showGracefulError();
    }
  };

  const handleAcceptChallenge = async () => {
    const uid = await ensureAuth(await getCurrentUserId());
    if (!challenge || !challenge.trim()) {
      Alert.alert('Invalid challenge', 'No challenge text available to accept.');
      return;
    }
    try {
      await updateActiveChallenge(uid, {
        challengeText: challenge.trim(),
        totalDays: 1,
        currentDay: 1,
        isComplete: false,
        isMultiDay: false,
        startDate: new Date().toISOString(),
        lastCompleted: null,
        completedDays: [],
      });
      await updateUserProfile(
        {
          lastChallenge: new Date().toISOString(),
          lastChallengeText: challenge.trim(),
        },
        uid,
      );
      setChallengeAccepted(true);
    } catch (err) {
      console.error('Accept challenge error:', err);
      showGracefulError();
    }
  };


  const handleComplete = async () => {
    const uid = await ensureAuth(await getCurrentUserId());

    const active = await getOrCreateActiveChallenge(uid);

    if (activeMulti && activeMulti.isMultiDay === true) {
      try {
        await completeChallengeDay();
        Alert.alert('Nice!', `Day ${activeMulti.currentDay} completed.`);
        fetchChallenge(true);
      } catch (err) {
        console.error('Multi-day complete error:', err);
        showGracefulError();
      }
      return;
    }

    try {
      const userData: UserProfile | null = await loadUserProfile(uid);
      const profile = userData ?? ({} as UserProfile);
      const now = new Date().toISOString();

      const newPoints = (profile.individualPoints ?? 0) + 1;
      const newStreak = (profile.challengeStreak?.count ?? 0) + 1;

      const recent = Array.isArray(profile.recentChallenges)
        ? [...profile.recentChallenges]
        : [];
      if (challenge && challenge.trim()) {
        recent.push({ text: challenge.trim(), timestamp: now });
      }

      console.log('➡️ Completing challenge for', uid);
      await updateUserProfile(
        {
          individualPoints: newPoints,
          challengeStreak: { count: newStreak, lastCompletedDate: now },
          recentChallenges: recent,
        },
        uid,
      );
      console.log('✅ Challenge profile update successful');

      console.log('➡️ Clearing active challenge');
      await deleteDocument(`users/${uid}/activeChallenge/current`);
      console.log('✅ Active challenge cleared');

      setStreakCount(newStreak);
      setLastCompletedDate(new Date());
      setChallenge('');
      setChallengeAccepted(false);
      setShowGenerateButton(true);
      showToast(
        "\ud83c\udf89 You've completed today's challenge and earned 1 point! Keep it up, soul traveler."
      );
    } catch (err) {
      console.error('Complete challenge error:', err);
      showGracefulError();
    }
  };

  const handleGenerateNewChallenge = async () => {
    const tokens = await getTokenCount();
    console.log('➡️ Generating new challenge, tokens:', tokens);
    if (tokens < 5) {
      Alert.alert('Not enough tokens', 'You need 5 tokens to generate a new challenge.');
      return;
    }
    await setTokenCount(tokens - 5);
    console.log('🪙 5 tokens deducted for new challenge');
    setShowGenerateButton(false);
    fetchChallenge(true);
  };
  useEffect(() => {
    if (!authReady || !uid) return;
    loadChallengeStreak();
    fetchChallenge();
  }, [authReady, uid]);

  return (
    <AuthGate>
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <CustomText style={styles.title}>Daily Challenge</CustomText>
        <CustomText style={styles.streak}>Streak: {streakCount} days</CustomText>
        {activeMulti ? (
          <>
            <CustomText style={styles.challengeText}>
              Day {activeMulti.currentDay} of {activeMulti.totalDays}
            </CustomText>
            <CustomText style={styles.challenge}>{activeMulti.challengeText}</CustomText>
          </>
        ) : loading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} />
        ) : (
          <CustomText style={styles.challenge}>
            {challenge || 'No challenge available.'}
          </CustomText>
        )}
        <View style={styles.buttonWrap}>
          {!activeMulti && challengeAccepted && canSkip && (
            <Button title="Skip Challenge" onPress={handleSkipChallenge} />
          )}
          {activeMulti ? (
            <Button title="Complete Day" onPress={handleComplete} />
          ) : challengeAccepted ? (
            <Button title="Mark Completed" onPress={handleComplete} />
          ) : showGenerateButton ? (
            <Button
              title="Generate New Challenge (cost: 5 tokens)"
              onPress={handleGenerateNewChallenge}
            />
          ) : (
            <Button title="Accept Challenge" onPress={handleAcceptChallenge} />
          )}
          {!activeMulti && challengeAccepted && (
            <Button title="Start 3-Day Challenge" onPress={handleStartMultiDay} />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}


