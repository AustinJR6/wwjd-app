import { useAuthStore } from '@/state/authStore';

export function logTokenIssue(context: string) {
  const { uid } = useAuthStore.getState();
  console.warn(`🔐 Token issue during ${context}`, { uid });
}
