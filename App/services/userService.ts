import { getDocument, setDocument } from "@/services/firestoreService";
import { useUserStore } from "@/state/userStore";
import { ensureAuth } from "@/utils/authGuard";

/**
 * Firestore user document structure
 */
export interface FirestoreUser {
  uid: string;
  email: string;
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
export async function ensureUserDocExists(uid: string, email?: string) {
  try {
    const snap = await getDocument(`users/${uid}`);
    if (!snap) {
      const payload: any = { uid, createdAt: Date.now() };
      if (email) payload.email = email;
      await setDocument(`users/${uid}`, payload);
      console.log("📄 Created user doc for", uid);
    } else {
      console.log("📄 User doc already exists for", uid);
    }
  } catch (err) {
    console.warn("⚠️ ensureUserDocExists failed", err);
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
      displayName: user.displayName ?? "",
      isSubscribed: user.isSubscribed,
      religion: user.religion,
      region: user.region ?? "",
      organizationId: user.organizationId,
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
  religion = "Christian",
  region = "",
  organizationId,
}: {
  uid: string;
  email: string;
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
    Object.entries(updates).filter(([_, v]) => v !== undefined),
  );
  await setDocument(`users/${storedUid}`, filtered);
}
