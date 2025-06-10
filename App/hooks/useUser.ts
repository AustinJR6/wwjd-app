import { useEffect, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

const firebaseAuth = auth();

export function useUser(): { user: FirebaseAuthTypes.User | null; loading: boolean } {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        try {
          const result = await firebaseAuth.signInAnonymously(); // ✅ no need to import auth again
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

