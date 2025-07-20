import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/config/firebaseClient';
import type { User } from 'firebase/auth';

export interface AuthUserLike {
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
}

export async function seedUserProfile(uid: string, authUser?: AuthUserLike): Promise<void> {
  if (!uid) throw new Error('uid is required');

  const now = Timestamp.now();
  const profile = {
    uid,
    email: authUser?.email ?? '',
    emailVerified: !!authUser?.emailVerified,
    displayName: authUser?.displayName ?? 'New User',
    createdAt: now,
    lastActive: now,
    lastFreeAsk: now,
    lastFreeSkip: now,
    onboardingComplete: false,
    religion: 'SpiritGuide',
    tokens: 5,
    skipTokensUsed: 0,
    individualPoints: 0,
    isSubscribed: false,
    nightModeEnabled: false,
    preferredName: null,
    pronouns: null,
    avatarURL: null,
    profileComplete: false,
    profileSchemaVersion: 'v1',
    challengeStreak: {
      count: 0,
      lastCompletedDate: null,
    },
    dailyChallengeCount: 0,
    dailySkipCount: 0,
    lastChallengeLoadDate: null,
    lastSkipDate: null,
    organization: null,
  };

  await setDoc(doc(firestore, 'users', uid), profile, { merge: true });
}

export async function verifyUserProfile(uid: string): Promise<void> {
  const snap = await getDoc(doc(firestore, 'users', uid));
  if (!snap.exists()) {
    console.log('⚠️ Profile missing for', uid);
    return;
  }
  const data = snap.data();
  const critical: (keyof typeof data)[] = [
    'uid',
    'email',
    'displayName',
    'createdAt',
    'religion',
    'tokens',
  ];
  const missing = critical.filter((k) => data[k] === undefined || data[k] === null);
  if (missing.length) {
    console.log('⚠️ Missing fields:', missing);
  } else {
    console.log('✅ Profile verified for', uid);
  }
}
