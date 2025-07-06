import { getItem, setItem, deleteItem } from '@/utils/secureStore';
import { signUpWithEmailAndPassword, signInWithEmailAndPassword } from '../../firebaseRest';
import axios from 'axios';
import Constants from 'expo-constants';

const TOKEN_KEY = 'firebase_id_token';
const REFRESH_KEY = 'firebase_refresh_token';
const UID_KEY = 'firebase_uid';
const API_KEY = Constants.expoConfig.extra.EXPO_PUBLIC_FIREBASE_API_KEY || '';
if (!API_KEY) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_API_KEY in .env');
}

let currentToken: string | null = null;
let currentRefresh: string | null = null;
let currentUid: string | null = null;

function isExpired(token: string) {
  try {
    const [, payload] = token.split('.');
    const data = JSON.parse(atob(payload));
    return data.exp * 1000 < Date.now() + 5 * 60 * 1000;
  } catch {
    return true;
  }
}

async function loadStoredCredentials() {
  if (currentToken && currentUid) return;
  currentToken = await getItem(TOKEN_KEY);
  currentRefresh = await getItem(REFRESH_KEY);
  currentUid = await getItem(UID_KEY);
}

function notify(cb: (user: any | null) => void) {
  if (currentUid && currentToken) cb({ uid: currentUid } as any);
  else cb(null);
}

export function observeAuthState(cb: (user: any | null) => void) {
  loadStoredCredentials().then(() => notify(cb));
  return () => {};
}

export async function signup(email: string, password: string) {
  try {
    const res = await signUpWithEmailAndPassword(email, password);
    currentToken = res.idToken;
    currentRefresh = res.refreshToken;
    currentUid = res.localId;
    await setItem(TOKEN_KEY, res.idToken);
    await setItem(REFRESH_KEY, res.refreshToken);
    await setItem(UID_KEY, res.localId);
    console.log('🎉 Signup successful');
    return { uid: res.localId, email: res.email };
  } catch (error: any) {
    console.warn('🚫 Signup Failed:', error.response?.data?.error?.message);
    throw error;
  }
}

export async function login(email: string, password: string) {
  const res = await signInWithEmailAndPassword(email, password);
  currentToken = res.idToken;
  currentRefresh = res.refreshToken;
  currentUid = res.localId;
  await setItem(TOKEN_KEY, res.idToken);
  await setItem(REFRESH_KEY, res.refreshToken);
  await setItem(UID_KEY, res.localId);
  return { uid: res.localId, email: res.email };
}

export async function logout() {
  currentToken = null;
  currentRefresh = null;
  currentUid = null;
  await deleteItem(TOKEN_KEY);
  await deleteItem(REFRESH_KEY);
  await deleteItem(UID_KEY);
}

export async function resetPassword(email: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;
  await axios.post(url, { requestType: 'PASSWORD_RESET', email });
}

export async function changePassword(newPassword: string) {
  const token = await getIdToken(true);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`;
  await axios.post(url, { idToken: token, password: newPassword, returnSecureToken: false });
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  await loadStoredCredentials();
  if (!currentRefresh) return null;
  if (!forceRefresh && currentToken && !isExpired(currentToken)) {
    return currentToken;
  }
  const url = `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;
  const res = await axios.post(url, { grant_type: 'refresh_token', refresh_token: currentRefresh });
  currentToken = res.data.id_token;
  currentRefresh = res.data.refresh_token;
  await setItem(TOKEN_KEY, currentToken);
  await setItem(REFRESH_KEY, currentRefresh);
  return currentToken;
}

export async function getToken(forceRefresh = false) {
  return getIdToken(forceRefresh);
}

export async function getCurrentUserId(): Promise<string | null> {
  await loadStoredCredentials();
  return currentUid;
}
