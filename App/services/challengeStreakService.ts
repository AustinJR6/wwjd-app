
import { updateUserProfile, loadUserProfile } from '@/utils/userProfile';
import { getCurrentUserId } from '@/utils/TokenManager';
import { ensureAuth } from '@/utils/authGuard';

export async function completeChallengeWithStreakCheck(): Promise<number | null> {
  const userId = await ensureAuth(await getCurrentUserId());
  if (!userId) return null;

  const userData = await loadUserProfile(userId);
  const streakData = userData?.challengeStreak || {};
  const currentCount = streakData.count || 0;
  const lastCompletedDate = streakData.lastCompletedDate
    ? new Date(streakData.lastCompletedDate)
    : null;

  const today = new Date().toISOString().split('T')[0];
  const last = lastCompletedDate ? lastCompletedDate.toISOString().split('T')[0] : null;

  let newCount = currentCount;
  if (last !== today) {
    newCount += 1;
  }

  await updateUserProfile(
    {
      challengeStreak: {
        count: newCount,
        lastCompletedDate: new Date().toISOString(),
      },
    },
    userId,
  );

  return newCount;
}
