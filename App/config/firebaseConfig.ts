// App/config/firebaseConfig.ts (Aligned for @react-native-firebase)
// ALL OLD CODE HAS BEEN REMOVED. Only @react-native-firebase imports remain.

// Import specific @react-native-firebase modules.
// Note: These imports automatically represent the initialized Firebase services
// because @react-native-firebase picks up configuration from native files (google-services.json).
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Export the instances of the services.
// You call the imported module (e.g., 'auth') as a function to get its specific instance.
export const firebaseAuth = auth();
export const db = firestore();
export const storageRef = storage();

// Optional: Enable offline persistence for Firestore (for bare workflow)
// This should be called once, typically early in your app lifecycle.
// For Expo managed workflow, persistence might be handled by Expo's build process or a plugin.
// db.settings({ cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED });
// db.enablePersistence().catch((err) => {
//   if (err.code === 'failed-precondition') {
//     console.warn('Firestore persistence failed: Multiple tabs open, persistence already enabled.');
//   } else if (err.code === 'unimplemented') {
//     console.warn('Firestore persistence not available on this environment.');
//   } else {
//     console.error('Firestore persistence failed:', err);
//   }
// });