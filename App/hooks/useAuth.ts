import { useEffect, useState } from 'react';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth'; // Correct User type import
import { firebaseAuth } from '../config/firebaseConfig.ts'; // Import aligned auth instance

export default function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((firebaseUser) => { // Use firebaseAuth instance
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}