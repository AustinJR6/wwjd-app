// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Use getAuth
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// **Remove the import of AsyncStorage and getReactNativePersistence if you're getting the error.**
// import AsyncStorage from '@react-native-async-storage/async-storage'
// import { getReactNativePersistence } from 'firebase/auth' // This is the problematic import

const firebaseConfig = {
  apiKey: "AIzaSyAeitpWVBGmPZJ540vgCNZpte_05LPx0Z8",
  authDomain: "wwjd-app.firebaseapp.com",
  projectId: "wwjd-app",
  storageBucket: "wwjd-app.firebasestorage.app",
  messagingSenderId: "402334171334",
  appId: "1:402334171334:web:69a89d40732306572757c7",
  measurementId: "G-20W5BML7DM"
};

const app = initializeApp(firebaseConfig);

// Simply get the auth instance without explicitly setting persistence
// Firebase v9 will attempt to use the best available persistence automatically.
const auth = getAuth(app);

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };