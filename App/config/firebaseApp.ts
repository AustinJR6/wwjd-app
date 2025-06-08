// App/config/firebaseApp.ts

import firebase from '@react-native-firebase/app';
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MSG_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};



let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
  console.log("✅ Firebase manually initialized");
} else {
  app = firebase.app();
  console.log("⚠️ Firebase already initialized");
}

export default app;
