import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export function observeAuthState(cb: (user: FirebaseAuthTypes.User | null) => void) {
  return auth().onAuthStateChanged(cb);
}

export async function signup(email: string, password: string) {
  const cred = await auth().createUserWithEmailAndPassword(email, password);
  return cred.user;
}

export async function login(email: string, password: string) {
  const cred = await auth().signInWithEmailAndPassword(email, password);
  return cred.user;
}

export function logout() {
  return auth().signOut();
}

export function resetPassword(email: string) {
  return auth().sendPasswordResetEmail(email);
}

export async function changePassword(newPassword: string) {
  if (!auth().currentUser) throw new Error('No authenticated user');
  await auth().currentUser?.updatePassword(newPassword);
}

export function getIdToken(forceRefresh = false): Promise<string | null> {
  return auth().currentUser?.getIdToken(forceRefresh) ?? Promise.resolve(null);
}

export async function getToken(forceRefresh = false): Promise<string | null> {
  return getIdToken(forceRefresh);
}

export async function getCurrentUserId(): Promise<string | null> {
  return auth().currentUser?.uid ?? null;
}
