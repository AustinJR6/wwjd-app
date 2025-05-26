// App/config/firebaseConfig.ts (for @react-native-firebase)
// Removed initializeApp and firebaseConfig object, as @react-native-firebase handles this
// using native config files (google-services.json, GoogleService-Info.plist).

// Import specific @react-native-firebase modules
import auth from '@react-native-firebase/auth'; // Import auth from @react-native-firebase
import firestore from '@react-native-firebase/firestore'; // Import firestore from @react-native-firebase
import storage from '@react-native-firebase/storage'; // Import storage from @react-native-firebase

// Export the instances of the services.
// Note: You call the imported module as a function to get the instance.
export const firebaseAuth = auth();
export const db = firestore();
export const storageRef = storage(); // Renamed to avoid conflict with `storage` variable in function scope

// If you need to explicitly enable persistence for Firestore (optional, but good practice):
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

// You may also want to export other configurations or functions related to Firebase setup here.