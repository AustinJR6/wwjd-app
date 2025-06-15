import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

export interface AuthResponse {
  idToken: string;
  localId: string;
  refreshToken: string;
  email: string;
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    await SecureStore.setItemAsync('idToken', res.data.idToken);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await axios.post<AuthResponse>(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    await SecureStore.setItemAsync('idToken', res.data.idToken);
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync('idToken');
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
      { requestType: 'PASSWORD_RESET', email }
    );
  } catch (error: any) {
    throw new Error(error.response?.data?.error?.message || error.message);
  }
}
