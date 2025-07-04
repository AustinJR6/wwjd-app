import { getDocument, setDocument } from "@/services/firestoreService";
import { useUserStore } from "@/state/userStore";
import { ensureAuth } from "@/utils/authGuard";

/**
 * Firestore user document structure
 */
export interface FirestoreUser {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  religion: string;
  region?: string;
  organizationId?: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  createdAt: number;
}

/**
 * Ensure the user document exists before accessing it
 */
export async function ensureUserDocExists(
  uid: string,
  email?: string,
): Promise<boolean> {
  try {
    await getDocument(`users/${uid}`);
    console.log("📄 User doc already exists for", uid);
    return false;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      const payload: any = { uid, createdAt: Date.now() };
      if (email) payload.email = email;
      await setDocument(`users/${uid}`, payload);
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
    const data = await getDocument(`users/${uid}`);
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

  const snapshot = await getDocument(`users/${storedUid}`);

  if (snapshot) {
    const user = snapshot as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      username: user.username ?? '',
      displayName: user.displayName ?? "",
      isSubscribed: user.isSubscribed,
      religion: user.religion,
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
  religion = "Christian",
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
    displayName,
    religion,
    region,
    isSubscribed: false,
    onboardingComplete: false,
    createdAt: now,
  };

  if (organizationId) {
    (userData as any).organizationId = organizationId;
  }

  await setDocument(`users/${storedUid}`, userData);
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await setDocument(`users/${storedUid}`, { onboardingComplete: true });
}

/**
 * Update religion or subscription status
 */
export async function updateUserFields(
  uid: string,
  updates: Partial<FirestoreUser>,
) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k, v]) => {
      if (v === undefined) return false;
      if (k === 'username' && typeof v === 'string' && v.trim() === '') {
        return false;
      }
      if (k === 'region' && typeof v === 'string' && v.trim() === '') {
        return false;
      }
      return true;
    }),
  );
  console.log('➡️ updateUserFields payload', { uid: storedUid, ...filtered });
  await setDocument(`users/${storedUid}`, filtered);
}
