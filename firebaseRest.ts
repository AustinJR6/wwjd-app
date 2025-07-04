import axios from 'axios';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';

const ID_BASE = `https://identitytoolkit.googleapis.com/v1`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
    return res.data;
  } catch (err: any) {
    if (err.response) {
      console.error('❌ signup error response', err.response.data);
    } else {
      console.error('❌ signup error', err.message);
    }
    throw err;
  }
}

export async function signInWithEmailAndPassword(email: string, password: string): Promise<AuthResponse> {
  const url = `${ID_BASE}/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await axios.post(url, { email, password, returnSecureToken: true });
  return res.data;
}

export async function getUserData(uid: string, idToken: string) {
  const url = `${FIRESTORE_BASE}/users/${uid}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${idToken}` } });
  return res.data;
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'number') fields[k] = { integerValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map((x) => ({ stringValue: String(x) })) } };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

export async function saveJournalEntry(uid: string, data: Record<string, any>, idToken: string) {
  const url = `${FIRESTORE_BASE}/journalEntries/${uid}/entries`;
  const body = { fields: toFirestoreFields(data) };
  const res = await axios.post(url, body, { headers: { Authorization: `Bearer ${idToken}` } });
  return res.data;
}

export const FIREBASE_ENDPOINTS = {
  signUp: `${ID_BASE}/accounts:signUp`,
  signIn: `${ID_BASE}/accounts:signInWithPassword`,
  refreshToken: `https://securetoken.googleapis.com/v1/token`,
  firestore: FIRESTORE_BASE,
};
