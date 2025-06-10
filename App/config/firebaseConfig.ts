import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export const firebaseAuth = auth();
export const db = firestore();
export const storageRef = storage();
