const PROJECT_ID = 'wwjd-app';
const FIRESTORE_URL =
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`;

// Type for the authUser argument
interface AuthUser {
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
}

// Type for the Firestore REST API body
interface FirestoreSeedBody {
  fields: Record<string, any>;
}

export async function seedUserProfile(
  uid: string,
  idToken: string,
  authUser: AuthUser = {},
): Promise<void> {
  const now = new Date().toISOString();

  const body: FirestoreSeedBody = {
    fields: {
      uid: { stringValue: uid },
      email: { stringValue: authUser.email || '' },
      emailVerified: { booleanValue: !!authUser.emailVerified },
      displayName: { stringValue: authUser.displayName || 'New User' },
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
      profileSchemaVersion: { integerValue: '1' },
      challengeStreak: {
        mapValue: {
          fields: {
            count: { integerValue: '0' },
            lastCompletedDate: { nullValue: null }
          }
        }
      },
      dailyChallengeCount: { integerValue: '0' },
      dailySkipCount: { integerValue: '0' },
      lastChallengeLoadDate: { nullValue: null },
      lastSkipDate: { nullValue: null },
      organization: { nullValue: null }
    }
  };

  const res = await fetch(`${FIRESTORE_URL}?documentId=${uid}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    let errorMsg: any = null;
    try {
      errorMsg = await res.json();
    } catch {
      errorMsg = await res.text();
    }
    console.error('🔥 Firestore seed failed:', res.status, errorMsg);
    throw new Error(`Firestore seed failed with status ${res.status}`);
  }

  console.log('✅ Document created:', res.status);
}
