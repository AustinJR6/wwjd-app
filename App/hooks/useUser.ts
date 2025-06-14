import { useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously, getAuth } from 'firebase/auth';
import { app } from '@/config/firebase';

export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(app), async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        try {
          const result = await signInAnonymously(getAuth(app));
          setUser(result.user);
        } catch (err) {
          console.error('🔥 Anonymous sign-in failed:', err);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

