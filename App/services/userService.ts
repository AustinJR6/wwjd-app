import { loadUserProfile, updateUserProfile } from "@/utils/userProfile";
import { useUserStore } from "@/state/userStore";
import { useUserProfileStore } from "@/state/userProfile";
import { ensureAuth } from "@/utils/authGuard";
import type { FirestoreUser, UserProfile } from "../../types";
import { DEFAULT_RELIGION } from "@/config/constants";

function generateUsernameFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Initialize optional user fields if they're missing.
 */
export async function initializeUserDataIfNeeded(uid: string): Promise<void> {
  const data: UserProfile | null = await loadUserProfile(uid);
  const profile = data ?? ({} as UserProfile);
  const payload: any = {};

  if (!profile.challengeStreak) {
    payload.challengeStreak = { count: 0, lastCompletedDate: null };
  }
  if (profile.dailyChallengeCount === undefined) {
    payload.dailyChallengeCount = 0;
  }
  if (profile.dailySkipCount === undefined) {
    payload.dailySkipCount = 0;
  }
  if (!profile.lastChallengeLoadDate) {
    payload.lastChallengeLoadDate = null;
  }
  if (!profile.lastSkipDate) {
    payload.lastSkipDate = null;
  }

  if (Object.keys(payload).length > 0) {
    await updateUserProfile(payload, uid);
  }
}

/**
 * Ensure the user document exists before accessing it
 */

export async function refreshLastActive(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  const lastActive = new Date().toISOString();
  useUserStore.getState().updateUser({ lastActive });
  await updateUserProfile({ lastActive }, storedUid);
}

/**
 * Fetch a user profile document without creating it
 */
export async function fetchUserProfile(
  uid: string,
): Promise<FirestoreUser | null> {
  try {
    const data = await loadUserProfile(uid);
    return data as FirestoreUser;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    console.warn("⚠️ fetchUserProfile failed", err);
    throw err;
  }
}

/**
 * Get user from Firestore and set into userStore
 */
export async function loadUser(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await initializeUserDataIfNeeded(storedUid);

  const snapshot = await loadUserProfile(storedUid);

  if (snapshot) {
    const user = snapshot as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      username: user.username ?? "",
      displayName: user.displayName ?? "",
      preferredName: user.preferredName ?? "",
      pronouns: user.pronouns ?? "",
      avatarURL: user.avatarURL ?? "",
      isSubscribed: user?.isSubscribed ?? false,
      religion: user?.religion ?? 'spiritual',
      religionId: user?.religionId || user?.religion || 'spiritual',
      region: user.region ?? "",
      organizationId: user.organizationId,
        onboardingComplete: user.onboardingComplete ?? false,
      profileComplete: user.profileComplete ?? false,
      profileSchemaVersion: user.profileSchemaVersion,
      lastActive: user.lastActive,
      tokens: 0, // placeholder
    });
  } else {
    throw new Error("User not found in Firestore.");
  }
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await updateUserProfile({ onboardingComplete: true }, storedUid);
}

