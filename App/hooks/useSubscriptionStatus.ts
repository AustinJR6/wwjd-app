import { useState, useEffect, useCallback } from 'react';
import { getDocumentByPath } from '@/services/firestoreService';

export function useSubscriptionStatus(uid: string | null): {
  isPlus: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const userDoc = await getDocumentByPath(`users/${uid}`);
      const usersIsSubscribed = userDoc?.isSubscribed;
      console.log('SUBS ▶ REST users.isSubscribed', usersIsSubscribed, 'fallback used?', usersIsSubscribed === undefined);
      if (typeof usersIsSubscribed === 'boolean') {
        setIsPlus(usersIsSubscribed);
      } else {
        const subDoc = await getDocumentByPath(`subscriptions/${uid}`);
        const status = subDoc?.status;
        const active = status === 'active' || status === 'trialing';
        setIsPlus(active);
      }
    } catch (err) {
      console.warn('Failed to fetch subscription status', err);
      setIsPlus(false);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!uid) {
    return { isPlus: false, loading: false, refresh: async () => {} };
  }

  return { isPlus, loading, refresh };
}

