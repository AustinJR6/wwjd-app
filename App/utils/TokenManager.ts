import { getDocument, setDocument } from '@/services/firestoreService';
import { updateUserProfile } from './userProfile';
import { ensureAuth } from '@/utils/authGuard';

export const getTokenCount = async () => {
  const uid = await ensureAuth();
  if (!uid) return 0;
  try {
    const snapshot = await getDocument(`users/${uid}`);
    const count = snapshot?.tokens ?? 0;
    console.log('🪙 Token count:', count);
    return count;
  } catch (err) {
    console.error('❌ Token fetch failed:', err);
    return 0;
  }
};

export const setTokenCount = async (count: number) => {
  const uid = await ensureAuth();
  if (!uid) return;

  await updateUserProfile({ tokens: count }, uid);
  console.log('🪙 Token count:', count);
};

export const consumeToken = async () => {
  const tokens = await getTokenCount();
  if (tokens > 0) {
    await setTokenCount(tokens - 1);
  }
};

export const canUseFreeAsk = async () => {
  const uid = await ensureAuth();
  if (!uid) return false;

  const snapshot = await getDocument(`freeAsk/${uid}`);
  if (!snapshot) return true;
  const lastUsed = snapshot.date ? new Date(snapshot.date) : null;
  if (!lastUsed) return true;

  const now = new Date();
  const nextAvailable = new Date(lastUsed);
  nextAvailable.setDate(nextAvailable.getDate() + 1);

  return now >= nextAvailable;
};

export const useFreeAsk = async () => {
  const uid = await ensureAuth();
  if (!uid) return;
  await setDocument(`freeAsk/${uid}`, { date: new Date().toISOString() });
};

export const syncSubscriptionStatus = async () => {
  const uid = await ensureAuth();
  if (!uid) return;
  const sub = await getDocument(`subscriptions/${uid}`);
  const isSubscribed = !!sub && sub.active === true;
  console.log('💎 OneVine+ Status:', isSubscribed);
  if (isSubscribed) {
    await updateUserProfile({ tokens: 9999 }, uid);
  }
};

export { getIdToken, getCurrentUserId, getAuthHeader, getAuthHeaders, getToken } from './authUtils';

export function init() {
  console.log('✅ TokenManager initialized');
}

