// App/config/firebaseConfig.ts

import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'

// These are already initialized singletons. No need to call as functions.
export const firebaseAuth = auth
export const db = firestore
export const storageRef = storage
