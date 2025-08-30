import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFunctions } from 'firebase/functions';
import Constants from 'expo-constants';

const cfg = Constants.expoConfig?.extra || {};

const firebaseConfig = {
  apiKey: cfg.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: cfg.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: cfg.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: cfg.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: cfg.EXPO_PUBLIC_FIREBASE_MSG_SENDER_ID || '',
  appId: cfg.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: cfg.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Default region where functions are deployed
export const functions = getFunctions(app, 'us-central1');

