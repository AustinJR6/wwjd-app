import { useAuthStore } from '@/state/authStore'

export function useAuth() {
  const idToken = useAuthStore((s) => s.idToken)
  const uid = useAuthStore((s) => s.uid)
  const authReady = useAuthStore((s) => s.authReady)

  return { idToken, uid, authReady }
}
