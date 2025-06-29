import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './firebase';

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

export const db = getFirestore(app);
export { app };
