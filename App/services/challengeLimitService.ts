import { Alert } from 'react-native';

import { loadUserProfile, updateUserProfile } from '../../utils/userProfile';
import type { UserProfile } from '../../types/profile';
import { getCurrentUserId } from '@/utils/TokenManager';
import { ensureAuth } from '@/utils/authGuard';

/**
 * Check if the current user can load a new challenge.
 * - Free users get 3 free challenges per day
 * - After the limit, 5 tokens are required per challenge
 * - dailyChallengeCount and lastChallengeLoadDate are stored in users/{uid}
 */
export async function canLoadNewChallenge(): Promise<boolean> {
  const uid = await ensureAuth(await getCurrentUserId());
  if (!uid) return false;

  const userData: UserProfile | null = await loadUserProfile(uid);
  const profile = userData ?? ({} as UserProfile);
  const isSubscribed = profile?.isSubscribed ?? false;
  const tokens = profile?.tokens ?? 0;
  let dailyChallengeCount = profile?.dailyChallengeCount ?? 0;
  const lastDate = profile.lastChallengeLoadDate
    ? new Date(userData.lastChallengeLoadDate).toISOString().split('T')[0]
    : null;
  const today = new Date().toISOString().split('T')[0];

  if (lastDate !== today) {
    dailyChallengeCount = 0;
  }

  if (isSubscribed || dailyChallengeCount < 3) {
    await updateUserProfile({
      dailyChallengeCount: dailyChallengeCount + 1,
      lastChallengeLoadDate: new Date().toISOString(),
    }, uid);
    return true;
  }

  if (tokens < 5) {
    Alert.alert(
      'Out of challenges',
      'You\u2019ve reached your daily free limit. Earn or purchase more tokens to continue.'
    );
    return false;
  }

  await updateUserProfile({
    tokens: tokens - 5,
    dailyChallengeCount: dailyChallengeCount + 1,
    lastChallengeLoadDate: new Date().toISOString(),
  }, uid);

  return true;
}
