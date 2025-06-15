import { firestore } from '@/config/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection
} from 'firebase/firestore';
import { useUserStore } from "@/state/userStore";
import { ensureAuth } from '@/utils/authGuard';

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
 * Get user from Firestore and set into userStore
 */
export async function loadUser(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const ref = doc(collection(firestore, 'users'), storedUid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const user = snapshot.data() as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? '',
      isSubscribed: user.isSubscribed,
      religion: user.religion,
      region: user.region ?? '',
      organizationId: user.organizationId,
      tokens: 0, // placeholder
    });
  } else {
    throw new Error('User not found in Firestore.');
  }
}

/**
 * Create user profile in Firestore on first signup
 */
export async function createUserProfile({
  uid,
  email,
  displayName,
  religion = 'Christian',
  region = '',
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

  const ref = doc(collection(firestore, 'users'), storedUid);
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

  await setDoc(ref, userData);
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const ref = doc(collection(firestore, 'users'), storedUid);
  await updateDoc(ref, { onboardingComplete: true });
}

/**
 * Update religion or subscription status
 */
export async function updateUserFields(
  uid: string,
  updates: Partial<FirestoreUser>
) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const ref = doc(collection(firestore, 'users'), storedUid);
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  );
  await setDoc(ref, filtered, { merge: true });
}

