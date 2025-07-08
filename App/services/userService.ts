import { loadUserProfile, updateUserProfile } from "../../utils/userProfile";
import { useUserStore } from "@/state/userStore";
import { ensureAuth } from "@/utils/authGuard";
import type { FirestoreUser, UserProfile } from "../../types/profile";

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
export async function ensureUserDocExists(
  uid: string,
  email?: string,
): Promise<boolean> {
  try {
    await loadUserProfile(uid);
    console.log("📄 User doc already exists for", uid);
    return false;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const payload: any = { uid, createdAt: Date.now(), individualPoints: 0 };
      if (email) payload.email = email;
      await updateUserProfile(payload, uid);
      console.log("📄 Created user doc for", uid);
      return true;
    }
    console.warn("⚠️ ensureUserDocExists failed", err);
    throw err;
  }
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
    console.warn('⚠️ fetchUserProfile failed', err);
    throw err;
  }
}

/**
 * Get user from Firestore and set into userStore
 */
export async function loadUser(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await ensureUserDocExists(storedUid);
  await initializeUserDataIfNeeded(storedUid);

  const snapshot = await loadUserProfile(storedUid);

  if (snapshot) {
    const user = snapshot as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      username: user.username ?? '',
      displayName: user.displayName ?? "",
      isSubscribed: user?.isSubscribed ?? false,
      religion: user?.religion ?? 'SpiritGuide',
      region: user.region ?? "",
      organizationId: user.organizationId,
      onboardingComplete: user.onboardingComplete,
      tokens: 0, // placeholder
    });
  } else {
    throw new Error("User not found in Firestore.");
  }
}

/**
 * Create user profile in Firestore on first signup
 */
export async function createUserProfile({
  uid,
  email,
  displayName,
  username,
  religion = "SpiritGuide",
  region = "",
  organizationId,
}: {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  religion?: string;
  region?: string;
  organizationId?: string;
}) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const now = Date.now();

  const userData: FirestoreUser = {
    uid,
    email,
    username,
    displayName: displayName || 'New User',
    religion,
    region,
    individualPoints: 0,
    isSubscribed: false,
    skipTokensUsed: 0,
    nightModeEnabled: false,
    religionPrefix: '',
    onboardingComplete: false,
    createdAt: now,
    streak: { current: 0, longest: 0, lastUpdated: new Date().toISOString() },
    challengeStreak: { count: 0, lastCompletedDate: null },
    dailyChallengeCount: 0,
    dailySkipCount: 0,
    lastChallengeLoadDate: null,
    lastSkipDate: null,
  } as any;

  if (organizationId) {
    (userData as any).organizationId = organizationId;
  }

  await updateUserProfile(userData, storedUid);
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await updateUserProfile({ onboardingComplete: true }, storedUid);
}

