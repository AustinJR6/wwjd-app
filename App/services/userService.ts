import { db } from '../config/firebaseConfig.ts'; // Import aligned db instance
import { doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore'; // Import functions from @react-native-firebase/firestore
import { useUserStore } from '../state/userStore.ts';

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
  const ref = doc(db, 'users', uid); // Use db instance
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    const user = snapshot.data() as FirestoreUser;
    useUserStore.getState().setUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName ?? '',
      isSubscribed: user.isSubscribed,
      religion: user.religion,
      tokens: 0, // default or ignored for now
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
  const ref = doc(db, 'users', uid); // Use db instance
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

  await setDoc(ref, userData);
}

/**
 * Mark onboarding complete
 */
export async function completeOnboarding(uid: string) {
  const ref = doc(db, 'users', uid); // Use db instance
  await updateDoc(ref, { onboardingComplete: true });
}

/**
 * Update religion or subscription status (optional)
 */
export async function updateUserFields(
  uid: string,
  updates: Partial<Pick<FirestoreUser, 'religion' | 'isSubscribed'>>
) {
  const ref = doc(db, 'users', uid); // Use db instance
  await updateDoc(ref, updates);
}