import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export const getTokenCount = async () => {
  const { auth, db } = await import('../config/firebaseConfig');
  const user = auth.currentUser;
  if (!user) return 0;

  const tokenRef = doc(db, 'tokens', user.uid);
  const tokenSnap = await getDoc(tokenRef);
  return tokenSnap.exists() ? tokenSnap.data().count || 0 : 0;
};

export const setTokenCount = async (count: number) => {
  const { auth, db } = await import('../config/firebaseConfig');
  const user = auth.currentUser;
  if (!user) return;

  const tokenRef = doc(db, 'tokens', user.uid);
  await setDoc(tokenRef, { count }, { merge: true });
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const { auth, db } = await import('../config/firebaseConfig');
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
  const { auth, db } = await import('../config/firebaseConfig');
  const user = auth.currentUser;
  if (!user) return;

  const docRef = doc(db, 'freeAsk', user.uid);
  await setDoc(docRef, { date: new Date() });
};

export const syncSubscriptionStatus = async () => {
  const { auth, db } = await import('../config/firebaseConfig');
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

// ✅ Named export for App.tsx usage
export function init() {
  console.log('✅ TokenManager initialized');
  // You could preload or sync tokens here if needed
}
