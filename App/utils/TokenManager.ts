import { firebaseAuth, db } from '../config/firebaseConfig.ts'; // Static import of aligned Firebase instances
import { doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore'; // Correct Firestore imports

export const getTokenCount = async () => {
  const user = firebaseAuth.currentUser; // Use firebaseAuth instance
  if (!user) return 0;

  const tokenRef = doc(db, 'tokens', user.uid); // Use db instance
  const tokenSnap = await getDoc(tokenRef);

  if (tokenSnap.exists()) {
    // FIX: Use non-null assertion operator (!) on docSnap.data()
    const data = tokenSnap.data()!; // Assert that data is not undefined here
    return data.count || 0;
  } else {
    // If the document doesn't exist, count is 0
    return 0;
  }
};

export const setTokenCount = async (count: number) => {
  const user = firebaseAuth.currentUser; // Use firebaseAuth instance
  if (!user) return;

  const tokenRef = doc(db, 'tokens', user.uid); // Use db instance
  await setDoc(tokenRef, { count }, { merge: true });
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const user = firebaseAuth.currentUser; // Use firebaseAuth instance
  if (!user) return false;

  const docRef = doc(db, 'freeAsk', user.uid); // Use db instance
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return true;

  // FIX: Use non-null assertion operator (!) on docSnap.data()
  const data = docSnap.data()!; // Assert that data is not undefined here
  const lastUsed = data.date?.toDate?.(); // Optional chaining for 'date' and 'toDate'
  if (!lastUsed) return true;

  const now = new Date();
  const nextAvailable = new Date(lastUsed);
  nextAvailable.setDate(nextAvailable.getDate() + 1);

  return now >= nextAvailable;
};

export const useFreeAsk = async () => {
  const user = firebaseAuth.currentUser; // Use firebaseAuth instance
  if (!user) return;

  const docRef = doc(db, 'freeAsk', user.uid); // Use db instance
  await setDoc(docRef, { date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const user = firebaseAuth.currentUser; // Use firebaseAuth instance
  if (!user) return;

  const subRef = doc(db, 'subscriptions', user.uid); // Use db instance
  const subSnap = await getDoc(subRef);

  // FIX: Use non-null assertion operator (!) on subSnap.data()
  const isSubscribed = subSnap.exists() && subSnap.data()!.active === true; // Assert data is not undefined

  const tokenRef = doc(db, 'tokens', user.uid); // Use db instance
  if (isSubscribed) {
    await setDoc(tokenRef, { count: 9999 }, { merge: true }); // Give essentially unlimited tokens
  }
};

export function init() {
  console.log('✅ TokenManager initialized');
}