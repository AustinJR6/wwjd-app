import { getItem, setItem, deleteItem } from '@/utils/secureStore';
import { generateDefaultUserData, createUserDocument } from '../../firebaseRest';
import { signUpWithEmail, signInWithEmail, withKey } from '../api/firebaseAuth';
import axios from 'axios';
import { FIREBASE_WEB_API_KEY } from '../config/env';

const TOKEN_KEY = 'firebase_id_token';
const REFRESH_KEY = 'firebase_refresh_token';
const UID_KEY = 'firebase_uid';

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
  let cancelled = false;
  const check = async () => {
    await loadStoredCredentials();
    if (!currentRefresh) {
      if (!cancelled) cb(null);
      return;
    }
    try {
      const token = await getIdToken(true);
      if (!token) throw new Error('refresh_failed');
      if (!cancelled) notify(cb);
    } catch (err) {
      await logout();
      if (!cancelled) cb(null);
    }
  };
  check();
  const id = setInterval(check, 5 * 60 * 1000);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

export async function signup(email: string, password: string) {
  try {
    const res = await signUpWithEmail(email, password);
    currentToken = res.idToken;
    currentRefresh = res.refreshToken;
    currentUid = res.localId;
    await setItem(TOKEN_KEY, res.idToken);
    await setItem(REFRESH_KEY, res.refreshToken);
    await setItem(UID_KEY, res.localId);
    const userData = generateDefaultUserData({
      uid: res.localId,
      email: res.email ?? '',
    });
    await createUserDocument(res.localId, userData, res.idToken);
    console.log('🎉 Signup successful');
    return { uid: res.localId, email: res.email };
  } catch (error: any) {
    console.warn('🚫 Signup Failed:', error.response?.data?.error?.message || error.message);
    throw error;
  }
}

export async function login(email: string, password: string) {
  try {
    const res = await signInWithEmail(email, password);
    currentToken = res.idToken;
    currentRefresh = res.refreshToken;
    currentUid = res.localId;
    await setItem(TOKEN_KEY, res.idToken);
    await setItem(REFRESH_KEY, res.refreshToken);
    await setItem(UID_KEY, res.localId);
    return { uid: res.localId, email: res.email };
  } catch (error: any) {
    console.warn('🚫 Login Failed:', error.response?.data?.error?.message || error.message);
    throw error;
  }
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
  const url = withKey('/accounts:sendOobCode');
  await axios.post(url, { requestType: 'PASSWORD_RESET', email });
}

export async function changePassword(newPassword: string) {
  const token = await getIdToken(true);
  const url = withKey('/accounts:update');
  await axios.post(url, {
    idToken: token,
    password: newPassword,
    returnSecureToken: false,
  });
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  await loadStoredCredentials();
  if (!currentRefresh) return null;
  if (!forceRefresh && currentToken && !isExpired(currentToken)) {
    return currentToken;
  }
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error('Missing Firebase Web API key');
  }
  const url = `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(
    FIREBASE_WEB_API_KEY,
  )}`;
  const res = await axios.post(url, {
    grant_type: 'refresh_token',
    refresh_token: currentRefresh,
  });
  const { id_token, refresh_token } = res.data as {
    id_token?: string;
    refresh_token?: string;
  };
  currentToken = id_token ?? null;
  currentRefresh = refresh_token ?? null;
  if (!currentToken || !currentRefresh) return null;
  await setItem(TOKEN_KEY, currentToken ?? '');
  await setItem(REFRESH_KEY, currentRefresh ?? '');
  return currentToken;
}

export async function getToken(forceRefresh = false) {
  return getIdToken(forceRefresh);
}

export async function getCurrentUserId(): Promise<string | null> {
  await loadStoredCredentials();
  return currentUid;
}
