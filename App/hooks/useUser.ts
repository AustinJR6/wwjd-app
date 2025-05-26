import { useEffect, useState } from 'react';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth'; // Correct User type import
import auth from '@react-native-firebase/auth'; // Import for signInAnonymously if not exporting from config
import { firebaseAuth } from '../config/firebaseConfig.ts'; // Import aligned auth instance

export function useUser(): { user: FirebaseAuthTypes.User | null; loading: boolean } {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged(async (firebaseUser) => { // Use firebaseAuth instance
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        try {
          // Use the auth instance from @react-native-firebase for anonymous sign-in
          const result = await auth().signInAnonymously();
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