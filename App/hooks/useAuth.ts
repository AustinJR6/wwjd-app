import { useEffect, useState } from 'react';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { firebaseAuth } from '@/config/firebaseConfig';

export default function useAuth() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}

