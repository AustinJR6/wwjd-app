
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore();
const auth = getAuth();

export const getTokenCount = async () => {
  const user = auth.currentUser;
  if (!user) return 0;
  const tokenRef = doc(db, 'tokens', user.uid);
  const tokenSnap = await getDoc(tokenRef);
  return tokenSnap.exists() ? tokenSnap.data().count || 0 : 0;
};

export const consumeToken = async (cost: number = 1) => {
    const user = auth.currentUser;
    if (!user) return;

    const tokenRef = doc(db, 'tokens', user.uid);
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) return;

    const current = tokenSnap.data().count || 0;
    if (current >= cost) {
        await updateDoc(tokenRef, { count: current - cost });
    }
};


export const canUseFreeAsk = async () => {
  const user = auth.currentUser;
  if (!user) return false;

  const docRef = doc(db, 'freeAsk', user.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return true;

  const lastUsed = docSnap.data().date?.toDate?.();
  if (!lastUsed) return true;

  const now = new Date();
  const nextAvailable = new Date(lastUsed);
  nextAvailable.setDate(nextAvailable.getDate() + 1);

  return now >= nextAvailable;
};

export const useFreeAsk = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, 'freeAsk', user.uid);
  await setDoc(docRef, { date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const subRef = doc(db, 'subscriptions', user.uid);
  const subSnap = await getDoc(subRef);

  const isSubscribed = subSnap.exists() && subSnap.data()?.active === true;

  const tokenRef = doc(db, 'tokens', user.uid);
  if (isSubscribed) {
    await setDoc(tokenRef, { count: 9999 }, { merge: true }); // Give essentially unlimited tokens
  }
};
