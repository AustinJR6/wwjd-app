import axios from 'axios';
import { logFirestoreError } from './App/lib/logging';
import Constants from 'expo-constants';
import { DEFAULT_RELIGION } from './App/config/constants';

export function generateUsernameFromDisplayName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const PROJECT_ID = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
if (!API_KEY) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_API_KEY in .env');
}
if (!PROJECT_ID) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env');
}

const ID_BASE = `https://identitytoolkit.googleapis.com/v1`;
export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export interface AuthResponse {
  idToken: string;
  refreshToken: string;
  localId: string;
  email: string;
}

export async function signUpWithEmailAndPassword(email: string, password: string): Promise<AuthResponse> {
  const url = `${ID_BASE}/accounts:signUp?key=${API_KEY}`;
  const payload = { email, password, returnSecureToken: true };
  console.log('➡️ signup request', { url, payload });
  try {
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('✅ signup response', res.data);

    // After successful signup, create default Firestore user doc
    const { localId, idToken, email: userEmail } = res.data as AuthResponse;
    try {
      await createUserDoc({
        uid: localId,
        email: userEmail,
        displayName: 'New User',
        username: generateUsernameFromDisplayName('New User'),
        region: '',
        religion: DEFAULT_RELIGION,
        idToken,
        preferredName: '',
        pronouns: '',
        avatarURL: '',
      });
    } catch (err) {
      console.error('❌ Failed to create default user document', err);
    }

    return res.data as AuthResponse;
  } catch (err: any) {
    if (err.response) {
      console.error('❌ signup error response', err.response.data);
    } else {
      console.error('❌ signup error', err.message);
    }
    console.warn('🚫 Signup Failed:', err.response?.data?.error?.message);
    throw err;
  }
}

export async function signInWithEmailAndPassword(email: string, password: string): Promise<AuthResponse> {
  const url = `${ID_BASE}/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await axios.post(url, { email, password, returnSecureToken: true });
  return res.data as AuthResponse;
}

export async function getUserData(uid: string, idToken: string) {
  const path = `users/${uid}`;
  const url = `${FIRESTORE_BASE}/${path}`;
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${idToken}` } });
    return res.data;
  } catch (err: any) {
    logFirestoreError('GET', path, err);
    throw err;
  }
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'number') fields[k] = { integerValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (Array.isArray(v))
      fields[k] = {
        arrayValue: {
          values: v.map((x) =>
            typeof x === 'object'
              ? { mapValue: { fields: toFirestoreFields(x) } }
              : { stringValue: String(x) }
          ),
        },
      };
    else if (typeof v === 'object') fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

export interface DefaultUserData {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  username?: string;
  region?: string;
  religion?: string;
  idToken: string;
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
}



export function generateDefaultUserData({
  uid,
  email = '',
  emailVerified = false,
  displayName = 'New User',
  username = '',
  region = '',
  religion = DEFAULT_RELIGION,
  preferredName = '',
  pronouns = '',
  avatarURL = '',
}: Partial<DefaultUserData> & { uid: string }): Omit<DefaultUserData, 'idToken'> & {
  createdAt: string;
  lastFreeAsk: string;
  lastFreeSkip: string;
  onboardingComplete: boolean;
  profileComplete: boolean;
  isSubscribed: boolean;
  individualPoints: number;
  tokens: number;
  skipTokensUsed: number;
  nightModeEnabled: boolean;
  organization: null | string;
  religionSlug: string;
  lastActive: string;
  profileSchemaVersion: number;
} {
  const slugify = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const now = new Date().toISOString();

  return {
    uid,
    email,
    emailVerified,
    displayName,
    username,
    createdAt: now,
    lastActive: now,
    religion,
    religionSlug: slugify(religion),
    region,
    organization: null,
    preferredName,
    pronouns,
    avatarURL,
    profileComplete: false,
    profileSchemaVersion: 1,
    individualPoints: 0,
    tokens: 0,
    skipTokensUsed: 0,
    lastFreeAsk: now,
    lastFreeSkip: now,
    isSubscribed: false,
    onboardingComplete: false,
    nightModeEnabled: false,
  };
}

export async function createUserDoc({
  uid,
  email,
  emailVerified = false,
  displayName,
  username,
  region,
  religion,
  idToken,
  preferredName = '',
  pronouns = '',
  avatarURL = '',
  organization = null,
}: {
  uid: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  username: string;
  region: string;
  religion: string;
  idToken: string;
  preferredName?: string;
  pronouns?: string;
  avatarURL?: string;
  organization?: string | null;
}) {
  const string = (v: string) => ({ stringValue: v });
  const bool = (v: boolean) => ({ booleanValue: v });
  const int = (v: number) => ({ integerValue: v.toString() });
  const time = (d: Date) => ({ timestampValue: d.toISOString() });
  const nullVal = () => ({ nullValue: null });

  const now = new Date();
  const path = `users/${uid}`;
  const url = `${FIRESTORE_BASE}/${path}`;

  const body = {
    fields: {
      uid: string(uid),
      email: string(email),
      emailVerified: bool(emailVerified),
      displayName: string(displayName),
      createdAt: time(now),
      lastActive: time(now),
      lastFreeAsk: time(now),
      lastFreeSkip: time(now),
      onboardingComplete: bool(false),
      religion: string(religion || DEFAULT_RELIGION),
      tokens: int(5),
      skipTokensUsed: int(0),
      individualPoints: int(0),
      isSubscribed: bool(false),
      nightModeEnabled: bool(false),
      preferredName: preferredName ? string(preferredName) : nullVal(),
      pronouns: pronouns ? string(pronouns) : nullVal(),
      avatarURL: avatarURL ? string(avatarURL) : nullVal(),
      profileComplete: bool(false),
      profileSchemaVersion: string('v1'),
      challengeStreak: {
        mapValue: {
          fields: {
            count: int(0),
            lastCompletedDate: nullVal(),
          },
        },
      },
      dailyChallengeCount: int(0),
      dailySkipCount: int(0),
      lastChallengeLoadDate: nullVal(),
      lastSkipDate: nullVal(),
      organization: typeof organization === 'string' ? string(organization) : nullVal(),
    },
  };

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
  console.log('➡️ createUserDoc', { url, body });
  try {
    await axios.post(url, body, { headers });
    console.log('✅ user doc created', uid);
  } catch (err: any) {
    logFirestoreError('POST', path, err);
    console.error('createUserDoc error', err?.response?.data || err);
    throw err;
  }
}

export async function saveJournalEntry(uid: string, data: Record<string, any>, idToken: string) {
  const path = `journalEntries/${uid}/entries`;
  const url = `${FIRESTORE_BASE}/${path}`;
  const body = { fields: toFirestoreFields(data) };
  try {
    const headers = { Authorization: `Bearer ${idToken}` };
    console.log('➡️ POST', url, { body, headers });
    const res = await axios.post(url, body, { headers });
    return res.data;
  } catch (err: any) {
    logFirestoreError('POST', path, err);
    console.error('saveJournalEntry error', err?.response?.data || err);
    throw err;
  }
}

export const FIREBASE_ENDPOINTS = {
  signUp: `${ID_BASE}/accounts:signUp`,
  signIn: `${ID_BASE}/accounts:signInWithPassword`,
  refreshToken: `https://securetoken.googleapis.com/v1/token`,
  firestore: FIRESTORE_BASE,
};
