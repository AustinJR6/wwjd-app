import { db } from '../config/firebaseConfig'; // Use aligned db instance
import { useUserStore } from '../state/userStore';

/**
 * Firestore user document structure
 */
export interface FirestoreUser {
  uid: string;
  email: string;
  displayName?: string;
  religion: string;
  isSubscribed: boolean;
  onboardingComplete: boolean;
  createdAt: number;
}

/**
 * Get user from Firestore and set into userStore
 */
export async function loadUser(uid: string): Promise<void> {
  const ref = db().collection('users').doc(uid);
  const snapshot = await ref.get();

  if (snapshot.exists()) {
    const user = snapshot.data() as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? '',
      isSubscribed: user.isSubscribed,
      religion: user.religion,
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
}: {
  uid: string;
  email: string;
  displayName?: string;
  religion?: string;
}) {
  const ref = db().collection('users').doc(uid);
  const now = Date.now();

  const userData: FirestoreUser = {
    uid,
    email,
    displayName,
    religion,
    isSubscribed: false,
    onboardingComplete: false,
    createdAt: now,
  };

  await ref.set(userData);
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const ref = db().collection('users').doc(uid);
  await ref.update({ onboardingComplete: true });
}

/**
 * Update religion or subscription status
 */
export async function updateUserFields(
  uid: string,
  updates: Partial<Pick<FirestoreUser, 'religion' | 'isSubscribed'>>
) {
  const ref = db().collection('users').doc(uid);
  await ref.update(updates);
}
