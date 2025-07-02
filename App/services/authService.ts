import { Alert } from 'react-native';
import { useAuthStore } from '@/state/authStore';
import { useUserStore } from '@/state/userStore';
import {
  signup as fbSignup,
  login as fbLogin,
  logout as fbLogout,
  resetPassword as fbResetPassword,
  changePassword as fbChangePassword,
  getIdToken as fbGetIdToken,
  observeAuthState,
} from '@/lib/auth';
import { resetToLogin } from '@/navigation/navigationRef';
import { ensureUserDocExists, loadUser } from './userService';

export function initAuthState(): void {
  const setAuthReady = useAuthStore.getState().setAuthReady;
  const setUid = useAuthStore.getState().setUid;
  observeAuthState(async (user) => {
    if (user) {
      setUid(user.uid);
      await ensureUserDocExists(user.uid, user.email ?? undefined);
      await loadUser(user.uid);
    } else {
      setUid(null);
      useUserStore.getState().clearUser();
    }
    setAuthReady(true);
  });
}

export async function signup(email: string, password: string) {
  const user = await fbSignup(email, password);
  useAuthStore.getState().setUid(user.uid);
  return { localId: user.uid, email: user.email ?? '' };
}

export async function login(email: string, password: string) {
  const user = await fbLogin(email, password);
  useAuthStore.getState().setUid(user.uid);
  return { localId: user.uid, email: user.email ?? '' };
}

export async function logout(): Promise<void> {
  await fbLogout();
  useUserStore.getState().clearUser();
  useAuthStore.getState().setUid(null);
}

export function resetPassword(email: string) {
  return fbResetPassword(email);
}

export function changePassword(newPassword: string) {
  return fbChangePassword(newPassword);
}

export function getIdToken(forceRefresh = false) {
  return fbGetIdToken(forceRefresh);
}

export function logTokenIssue(context: string) {
  const { uid } = useAuthStore.getState();
  console.warn(`🔐 Token issue during ${context}`, { uid });
}

export async function signOutAndRetry(): Promise<void> {
  console.warn('🚪 Auth failure detected');
  Alert.alert('Session expired', 'Please sign in again.');
  await logout();
  resetToLogin();
}
