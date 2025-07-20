import { FIRESTORE_BASE } from '../../firebaseRest';
import { logFirestoreError } from '@/lib/logging';

export interface AuthUserLike {
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
}

export async function seedUserProfile(
  uid: string,
  idToken: string,
  authUser: AuthUserLike = {},
): Promise<boolean> {
  if (!uid) throw new Error('uid is required');

  const now = new Date().toISOString();
  const fields = {
    uid: { stringValue: uid },
    email: { stringValue: authUser.email ?? '' },
    emailVerified: { booleanValue: authUser.emailVerified ?? false },
    displayName: { stringValue: authUser.displayName ?? 'New User' },
    createdAt: { timestampValue: now },
    lastActive: { timestampValue: now },
    lastFreeAsk: { timestampValue: now },
    lastFreeSkip: { timestampValue: now },
    onboardingComplete: { booleanValue: false },
    religion: { stringValue: 'SpiritGuide' },
    tokens: { integerValue: '5' },
    skipTokensUsed: { integerValue: '0' },
    individualPoints: { integerValue: '0' },
    isSubscribed: { booleanValue: false },
    nightModeEnabled: { booleanValue: false },
    preferredName: { nullValue: null },
    pronouns: { nullValue: null },
    avatarURL: { nullValue: null },
    profileComplete: { booleanValue: false },
    profileSchemaVersion: { stringValue: 'v1' },
    challengeStreak: {
      mapValue: {
        fields: {
          count: { integerValue: '0' },
          lastCompletedDate: { nullValue: null },
        },
      },
    },
    dailyChallengeCount: { integerValue: '0' },
    dailySkipCount: { integerValue: '0' },
    lastChallengeLoadDate: { nullValue: null },
    lastSkipDate: { nullValue: null },
    organization: { nullValue: null },
  };

  const url = `${FIRESTORE_BASE}/users/${uid}`;
  const body = JSON.stringify({ fields });
  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const res = await fetch(url, { method: 'PATCH', headers, body });
    if (!res.ok) {
      const text = await res.text();
      console.error('❌ seedUserProfile failed', res.status, text);
      return false;
    }
    console.log('✅ user profile seeded', uid);
    return true;
  } catch (err: any) {
    logFirestoreError('PATCH', `users/${uid}`, err);
    console.error('seedUserProfile error', err);
    return false;
  }
}

export async function verifyUserProfile(
  uid: string,
  idToken: string,
): Promise<void> {
  const url = `${FIRESTORE_BASE}/users/${uid}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      console.log('⚠️ Profile missing for', uid);
      return;
    }
    const data = (await res.json()) as any;
    const fields = data.fields || {};
    const critical = [
      'uid',
      'email',
      'displayName',
      'createdAt',
      'religion',
      'tokens',
    ];
    const missing = critical.filter((k) => fields[k] === undefined);
    if (missing.length) {
      console.log('⚠️ Missing fields:', missing);
    } else {
      console.log('✅ Profile verified for', uid);
    }
  } catch (err: any) {
    logFirestoreError('GET', `users/${uid}`, err);
    console.error('verifyUserProfile error', err);
  }
}
