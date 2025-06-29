import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase';

const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);

let authReadyPromise: Promise<void> | null = null;

export function waitForFirebaseAuthReady(): Promise<void> {
  if (auth.currentUser) return Promise.resolve();
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, () => {
        unsubscribe();
        resolve();
      });
    });
  }
  return authReadyPromise;
}

export { app };
