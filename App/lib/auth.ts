import { auth } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

export function observeAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function signup(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export function logout() {
  return signOut(auth);
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function changePassword(newPassword: string) {
  if (!auth.currentUser) throw new Error('No authenticated user');
  await updatePassword(auth.currentUser, newPassword);
}

export function getIdToken(forceRefresh = false): Promise<string | null> {
  return auth.currentUser?.getIdToken(forceRefresh) ?? Promise.resolve(null);
}

export async function getToken(forceRefresh = false): Promise<string | null> {
  return getIdToken(forceRefresh);
}

export async function getCurrentUserId(): Promise<string | null> {
  return auth.currentUser?.uid ?? null;
}
