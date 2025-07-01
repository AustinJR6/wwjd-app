import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';

// The native configuration from google-services.json is used automatically.
export const app = firebase.app();
export const db = firestore();
export const cloudFunctions = functions();
export { auth, storage, cloudFunctions as functions };
