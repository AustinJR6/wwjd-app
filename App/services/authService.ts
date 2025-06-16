import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const BASE_URL = 'https://identitytoolkit.googleapis.com/v1';

export interface AuthResponse {
  idToken: string;
  localId: string;
  refreshToken: string;
  email: string;
}

// ✅ Register new user
export async function signup(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:signUp?key=${API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    await storeAuth(res.data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Login existing user
export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    await storeAuth(res.data);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Logout
export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('idToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('userId');
  await SecureStore.deleteItemAsync('email');
}

// ✅ Trigger password reset email
export async function resetPassword(email: string): Promise<void> {
  try {
    await axios.post(
      `${BASE_URL}/accounts:sendOobCode?key=${API_KEY}`,
      { requestType: 'PASSWORD_RESET', email }
    );
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

export async function changePassword(newPassword: string): Promise<void> {
  const idToken = await getStoredToken();
  if (!idToken) throw new Error('Missing auth token');
  try {
    const res = await axios.post<AuthResponse>(
      `${BASE_URL}/accounts:update?key=${API_KEY}`,
      { idToken, password: newPassword, returnSecureToken: true }
    );
    await storeAuth(res.data);
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

// ✅ Get stored token (if any)
export async function getStoredToken(): Promise<string | null> {
  const token = await SecureStore.getItemAsync('idToken');
  if (!token) {
    console.warn('🚫 idToken missing from SecureStore');
  }
  return token;
}

// ✅ Save token securely
async function storeAuth(auth: AuthResponse) {
  await SecureStore.setItemAsync('idToken', auth.idToken);
  await SecureStore.setItemAsync('refreshToken', auth.refreshToken);
  await SecureStore.setItemAsync('userId', auth.localId);
  await SecureStore.setItemAsync('email', auth.email);
}

