import { firestore } from '@/config/firebase';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';

async function getUid(): Promise<string | null> {
  return await SecureStore.getItemAsync('localId');
}

export const getTokenCount = async () => {
  const uid = await getUid();
  if (!uid) return 0;

  const tokenRef = doc(collection(firestore, 'tokens'), uid);
  const tokenSnap = await getDoc(tokenRef);

  if (tokenSnap.exists()) {
    const data = tokenSnap.data()!;
    return data.count || 0;
  } else {
    return 0;
  }
};

export const setTokenCount = async (count: number) => {
  const uid = await getUid();
  if (!uid) return;

  const tokenRef = doc(collection(firestore, 'tokens'), uid);
  await setDoc(tokenRef, { count }, { merge: true });
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const uid = await getUid();
  if (!uid) return false;

  const docRef = doc(collection(firestore, 'freeAsk'), uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return true;

  const data = docSnap.data()!;
  const lastUsed = data.date?.toDate?.();
  if (!lastUsed) return true;

  const now = new Date();
  const nextAvailable = new Date(lastUsed);
  nextAvailable.setDate(nextAvailable.getDate() + 1);

  return now >= nextAvailable;
};

export const useFreeAsk = async () => {
  const uid = await getUid();
  if (!uid) return;

  const docRef = doc(collection(firestore, 'freeAsk'), uid);
  await setDoc(docRef, { date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const uid = await getUid();
  if (!uid) return;

  const subRef = doc(collection(firestore, 'subscriptions'), uid);
  const subSnap = await getDoc(subRef);

  const isSubscribed = subSnap.exists() && subSnap.data()!.active === true;

  const tokenRef = doc(collection(firestore, 'tokens'), uid);
  if (isSubscribed) {
    await setDoc(tokenRef, { count: 9999 }, { merge: true });
  }
};

export function init() {
  console.log('✅ TokenManager initialized');
}

