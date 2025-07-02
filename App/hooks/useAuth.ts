import { useAuthStore } from '@/state/authStore';

export function useAuth() {
  const uid = useAuthStore((s) => s.uid);
  const idToken = useAuthStore((s) => s.idToken);
  const authReady = useAuthStore((s) => s.authReady);

  return { uid, idToken, authReady };
}
