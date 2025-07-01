import { useAuthStore } from '@/state/authStore';

export function useAuth() {
  const uid = useAuthStore((s) => s.uid);
  const authReady = useAuthStore((s) => s.authReady);

  return { uid, authReady };
}
