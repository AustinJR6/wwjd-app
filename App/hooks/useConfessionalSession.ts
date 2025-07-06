import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { fetchTempSession, clearConfessionalSession, TempMessage } from '@/services/confessionalSessionService';
import { ensureAuth } from '@/utils/authGuard';
import { getCurrentUserId } from '@/utils/TokenManager';
import { useAuth } from './useAuth';

export function useConfessionalSession() {
  const { authReady, uid } = useAuth();
  const [messages, setMessages] = useState<TempMessage[]>([]);

  useEffect(() => {
    if (!authReady || !uid) return;
    let mounted = true;
    const load = async () => {
      const firebaseUid = await getCurrentUserId();
      const checkUid = await ensureAuth(firebaseUid);
      const hist = await fetchTempSession(checkUid);
      if (mounted) setMessages(hist);
    };
    load();

    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        endSession();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
      endSession();
    };
  }, [authReady, uid]);

  const endSession = async () => {
    const firebaseUid = await getCurrentUserId();
    const checkUid = await ensureAuth(firebaseUid);
    await clearConfessionalSession(checkUid);
    setMessages([]);
  };

  return { messages, setMessages, endSession };
}

