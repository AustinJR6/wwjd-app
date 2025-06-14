import { app, firestore } from '@/config/firebase';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';

export const getTokenCount = async () => {
  const user = getAuth(app).currentUser;
  if (!user) return 0;

  const tokenRef = doc(collection(firestore, 'tokens'), user.uid);
  const tokenSnap = await getDoc(tokenRef);

  if (tokenSnap.exists) {
    const data = tokenSnap.data()!;
    return data.count || 0;
  } else {
    return 0;
  }
};

export const setTokenCount = async (count: number) => {
  const user = getAuth(app).currentUser;
  if (!user) return;

  const tokenRef = doc(collection(firestore, 'tokens'), user.uid);
  await setDoc(tokenRef, { count }, { merge: true });
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const user = getAuth(app).currentUser;
  if (!user) return false;

  const docRef = doc(collection(firestore, 'freeAsk'), user.uid);
  const docSnap = await getDoc(docRef);

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
  const user = getAuth(app).currentUser;
  if (!user) return;

  const docRef = doc(collection(firestore, 'freeAsk'), user.uid);
  await setDoc(docRef, { date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const user = getAuth(app).currentUser;
  if (!user) return;

  const subRef = doc(collection(firestore, 'subscriptions'), user.uid);
  const subSnap = await getDoc(subRef);

  const isSubscribed = subSnap.exists && subSnap.data()!.active === true;

  const tokenRef = doc(collection(firestore, 'tokens'), user.uid);
  if (isSubscribed) {
    await tokenRef.set({ count: 9999 }, { merge: true });
  }
};

export function init() {
  console.log('✅ TokenManager initialized');
}

