// Ensure the Firebase native app is initialized
import app from '@react-native-firebase/app';

try {
  const defaultApp = app();
  console.log(`✅ Firebase app initialized: ${defaultApp.name}`, defaultApp.options);
} catch (err) {
  console.error('🔥 Firebase init failure:', err);
}

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export { auth, firestore, storage };
