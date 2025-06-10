import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const firebaseAuth = auth();
const db = firestore();

export const getTokenCount = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) return 0;

  const tokenRef = db.collection('tokens').doc(user.uid);
  const tokenSnap = await tokenRef.get();

  if (tokenSnap.exists) {
    const data = tokenSnap.data()!;
    return data.count || 0;
  } else {
    return 0;
  }
};

export const setTokenCount = async (count: number) => {
  const user = firebaseAuth.currentUser;
  if (!user) return;

  const tokenRef = db.collection('tokens').doc(user.uid);
  await tokenRef.set({ count }, { merge: true });
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) return false;

  const docRef = db.collection('freeAsk').doc(user.uid);
  const docSnap = await docRef.get();

  if (!docSnap.exists) return true;

  const data = docSnap.data()!;
  const lastUsed = data.date?.toDate?.();
  if (!lastUsed) return true;

  const now = new Date();
  const nextAvailable = new Date(lastUsed);
  nextAvailable.setDate(nextAvailable.getDate() + 1);

  return now >= nextAvailable;
};

export const useFreeAsk = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) return;

  const docRef = db.collection('freeAsk').doc(user.uid);
  await docRef.set({ date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) return;

  const subRef = db.collection('subscriptions').doc(user.uid);
  const subSnap = await subRef.get();

  const isSubscribed = subSnap.exists && subSnap.data()!.active === true;

  const tokenRef = db.collection('tokens').doc(user.uid);
  if (isSubscribed) {
    await tokenRef.set({ count: 9999 }, { merge: true });
  }
};

export function init() {
  console.log('✅ TokenManager initialized');
}

