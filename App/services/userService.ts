import { getDocument, setDocument } from './firestoreService';
import { useUserDataStore } from '@/state/userDataStore';
import { ensureAuth } from '@/utils/authGuard';

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

export async function loadUser(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const snapshot = await getDocument(`users/${storedUid}`);

  if (snapshot) {
    const user = snapshot as FirestoreUser;
    useUserDataStore.setState((state) => ({
      userProfile: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName ?? '',
        religion: user.religion,
        region: user.region ?? '',
        organizationId: user.organizationId,
      },
      isSubscribed: user.isSubscribed,
    }));
  } else {
    throw new Error('User not found in Firestore.');
  }
}

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

export async function completeOnboarding(uid: string) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  await setDocument(`users/${storedUid}`, { onboardingComplete: true });
}

export async function updateUserFields(
  uid: string,
  updates: Partial<FirestoreUser>
) {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;

  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  );
  await setDocument(`users/${storedUid}`, filtered);
}
