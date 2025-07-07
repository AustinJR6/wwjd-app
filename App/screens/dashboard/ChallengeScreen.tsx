import React, { useEffect, useState } from 'react';
import CustomText from '@/components/CustomText';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView} from 'react-native';
import Button from '@/components/common/Button';
import ScreenContainer from "@/components/theme/ScreenContainer";
import { useTheme } from "@/components/theme/theme";
import { getTokenCount, setTokenCount } from "@/utils/TokenManager";
import { showGracefulError } from '@/utils/gracefulError';
import { ASK_GEMINI_SIMPLE, GENERATE_CHALLENGE_URL } from "@/utils/constants";
import {
  getDocument,
  setDocument,
  getOrCreateActiveChallenge,
} from '@/services/firestoreService';
import { updateUserProfile } from '../../../utils/firestoreHelpers';
import { canLoadNewChallenge } from '@/services/challengeLimitService';
import { completeChallengeWithStreakCheck } from '@/services/challengeStreakService';
import {
  callFunction,
  awardPointsToUser,
  createMultiDayChallenge,
  completeChallengeDay,
} from '@/services/functionService';
import { ensureAuth } from '@/utils/authGuard';
import { getToken, getCurrentUserId } from '@/utils/TokenManager';
import { useAuth } from '@/hooks/useAuth';
import { sendGeminiPrompt } from '@/services/geminiService';
import AuthGate from '@/components/AuthGate';

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
  const [loading, setLoading] = useState(false);
  const [canSkip, setCanSkip] = useState(true);
  const [streakCount, setStreakCount] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState<Date | null>(null);
  const { authReady, uid } = useAuth();

  const checkMilestoneReward = async (current: number) => {
    const milestones = [3, 7, 14, 30];
    if (!milestones.includes(current)) return;
    const uid = await ensureAuth(await getCurrentUserId());
    try {
      const userData = await getDocument(`users/${uid}`) || {};
      const granted = userData.streakMilestones || {};
      const key = `m${current}`;
      if (granted[key]) return;
      const reward = current >= 30 ? 10 : current >= 14 ? 7 : 5;
      const tokens = await getTokenCount();
      await setTokenCount(tokens + reward);
      await updateUserProfile(uid, {
        streakMilestones: { ...granted, [key]: true },
      });

      const religion = userData?.religion;
      if (!uid || !religion) {
        console.warn('⚠️ Challenge generation blocked — missing uid or religion', {
          uid,
          religion,
        });
        return;
      }

      const blessing = await sendGeminiPrompt({
        url: ASK_GEMINI_SIMPLE,
        prompt: `Provide a short blessing for a user who reached a ${current}-day spiritual challenge streak in the ${religion} tradition.`,
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
    const data = await getDocument(`users/${uid}`);
    const streakData = data?.challengeStreak || {};
    setStreakCount(streakData.count || 0);
    setLastCompletedDate(streakData.lastCompletedDate ? new Date(streakData.lastCompletedDate) : null);
  };

  const fetchChallenge = async (forceNew = false) => {
    try {

      const uid = await ensureAuth(await getCurrentUserId());

      let active = await getOrCreateActiveChallenge(uid);
      if (active && !active.isComplete) {
        setActiveMulti(active);
        setLoading(false);
        return;
      } else {
        setActiveMulti(null);
      }

      setLoading(true);

      const userData = await getDocument(`users/${uid}`) || {};
      const lastChallenge = userData.lastChallenge?.toDate?.();
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      if (!forceNew && lastChallenge && now.getTime() - lastChallenge.getTime() < oneDay) {
        setChallenge(userData.lastChallengeText || '');
        setCanSkip(false);
        setLoading(false);
        return;
      }

      const allowed = await canLoadNewChallenge();
      if (!allowed) {
        setLoading(false);
        return;
      }

      const religion = userData?.religion;
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

      const newChallenge = await sendGeminiPrompt({
        url: GENERATE_CHALLENGE_URL,
        prompt,
        history: [],
        token: debugToken || undefined,
        religion,
      });
      if (!newChallenge) {
        showGracefulError('AI failed to provide a challenge.');
        setChallenge('Reflect in silence for five minutes today.');
      } else {
        console.log('🌟 New Challenge:', newChallenge);
        setChallenge(newChallenge);
      }

      await updateUserProfile(uid, {
        lastChallenge: new Date().toISOString(),
        lastChallengeText: newChallenge || '',
      });
    } catch (err: any) {
      console.error('🔥 API Error:', err?.response?.data || err.message);
      showGracefulError('Unable to load challenge data — please try again later');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipChallenge = async () => {
    const uid = await ensureAuth(await getCurrentUserId());

    await getOrCreateActiveChallenge(uid);

    const userData = (await getDocument(`users/${uid}`)) || {};
    const today = new Date().toISOString().split('T')[0];
    let history = userData.dailyChallengeHistory || { date: today, completed: 0, skipped: 0 };
    if (history.date !== today) history = { date: today, completed: 0, skipped: 0 };

    const tokens = userData?.tokens ?? 0;
    let dailySkipCount = userData?.dailySkipCount ?? 0;
    const lastSkipDate = userData?.lastSkipDate;
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
      await updateUserProfile(uid, {
        tokens: tokens - skipCost,
        dailySkipCount: dailySkipCount + 1,
        lastSkipDate: new Date().toISOString(),
        dailyChallengeHistory: { ...history, skipped: history.skipped + 1 },
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
      const userData = (await getDocument(`users/${uid}`)) || {};
      const religion = userData?.religion;
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

  const handleComplete = async () => {
    const uid = await ensureAuth(await getCurrentUserId());

    await getOrCreateActiveChallenge(uid);

    if (activeMulti) {
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

    const userData = await getDocument(`users/${uid}`) || {};

    const today = new Date().toISOString().slice(0, 10);
    let history = userData.dailyChallengeHistory || { date: today, completed: 0, skipped: 0 };
    if (history.date !== today) {
      history = { date: today, completed: 0, skipped: 0 };
    }

    const limit = (userData?.isSubscribed ?? false) ? 3 : 1;
    let useToken = false;
    if (history.completed >= limit) {
      const tokens = await getTokenCount();
      if (tokens <= 0) {
        Alert.alert('Daily Limit Reached', 'You\u2019ve completed all allowed challenges today.');
        return;
      }
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Use 1 Token to Continue?',
          'You\u2019ve hit today\u2019s limit. Spend a token for another challenge?',
          [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Yes', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;
      await setTokenCount(tokens - 1);
      useToken = true;
    }

    history.completed += 1;
    await updateUserProfile(uid, { dailyChallengeHistory: history });
    try {
      console.log('Current user:', await getCurrentUserId());
      const cfToken = await getToken(true);
      console.log('ID Token:', cfToken);
      await callFunction('completeChallenge', { useToken });
    } catch (err) {
      console.error('Backend validation failed:', err);
    }

    const updated = await completeChallengeWithStreakCheck();
    const todayStr = new Date().toISOString().split('T')[0];
    const lastStr = lastCompletedDate
      ? lastCompletedDate.toISOString().split('T')[0]
      : null;

    if (updated != null) {
      if (updated > streakCount) {
        await checkMilestoneReward(updated);
      }
      setStreakCount(updated);
      setLastCompletedDate(new Date());
    }

    const currentTokens = await getTokenCount();
    await setTokenCount(currentTokens + 1);

    await updateUserProfile(uid, {
      individualPoints: (userData.individualPoints || 0) + 2,
    });

    try {
      await awardPointsToUser(2);
    } catch (err: any) {
      console.error('🔥 Backend error:', err.response?.data || err.message);
    }

    if (updated != null && updated === streakCount && lastStr === todayStr) {
      Alert.alert(
        'Challenge Already Completed',
        "You've already completed your challenge for today. Come back tomorrow to continue your streak and grow even stronger."
      );
    } else {
      Alert.alert('Great job!', 'Challenge completed.');
    }
    const shouldGenerateNew = useToken || history.completed < limit;
    fetchChallenge(shouldGenerateNew);
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
          {!activeMulti && canSkip && (
            <Button title="Skip Challenge" onPress={handleSkipChallenge} />
          )}
          {activeMulti ? (
            <Button title="Complete Day" onPress={handleComplete} />
          ) : (
            <Button title="Mark Completed" onPress={handleComplete} />
          )}
          {!activeMulti && (
            <Button title="Start 3-Day Challenge" onPress={handleStartMultiDay} />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
    </AuthGate>
  );
}


