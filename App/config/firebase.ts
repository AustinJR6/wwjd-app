// Ensure the Firebase native app is initialized
import { firebase } from '@react-native-firebase/app';

if (!firebase.apps.length) {
  firebase.initializeApp();
}

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export { auth, firestore, storage };
