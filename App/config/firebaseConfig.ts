// firebaseConfig.ts
import { initializeApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence } from 'firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyAeitpWVBGmPZJ540vgCNZpte_05LPx0Z8",
  authDomain: "wwjd-app.firebaseapp.com",
  projectId: "wwjd-app",
  storageBucket: "wwjd-app.firebasestorage.app",
  messagingSenderId: "402334171334",
  appId: "1:402334171334:web:69a89d40732306572757c7",
  measurementId: "G-20W5BML7DM"
}

const app = initializeApp(firebaseConfig)

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
})

const db = getFirestore(app)
const storage = getStorage(app)

export { auth, db, storage }
