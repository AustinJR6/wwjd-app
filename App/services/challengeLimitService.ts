import { Alert } from 'react-native';
import { getDocument, setDocument } from '@/services/firestoreService';
import { updateUserProfile } from '@/utils/firestoreHelpers';
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

  const userData = (await getDocument(`users/${uid}`)) || {};
  const isSubscribed = userData?.isSubscribed ?? false;
  const tokens = userData?.tokens ?? 0;
  let dailyChallengeCount = userData?.dailyChallengeCount ?? 0;
  const lastDate = userData.lastChallengeLoadDate
    ? new Date(userData.lastChallengeLoadDate).toISOString().split('T')[0]
    : null;
  const today = new Date().toISOString().split('T')[0];

  if (lastDate !== today) {
    dailyChallengeCount = 0;
  }

  if (isSubscribed || dailyChallengeCount < 3) {
    await updateUserProfile(uid, {
      dailyChallengeCount: dailyChallengeCount + 1,
      lastChallengeLoadDate: new Date().toISOString(),
    });
    return true;
  }

  if (tokens < 5) {
    Alert.alert(
      'Out of challenges',
      'You\u2019ve reached your daily free limit. Earn or purchase more tokens to continue.'
    );
    return false;
  }

  await updateUserProfile(uid, {
    tokens: tokens - 5,
    dailyChallengeCount: dailyChallengeCount + 1,
    lastChallengeLoadDate: new Date().toISOString(),
  });

  return true;
}
