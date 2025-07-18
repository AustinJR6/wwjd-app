import { logout as fbLogout } from '@/lib/auth';
import { useUserStore } from '@/state/userStore';
import { useAuthStore } from '@/state/authStore';

export async function performLogout(): Promise<void> {
  await fbLogout();
  useUserStore.getState().clearUser();
  useAuthStore.getState().setUid(null);
  useAuthStore.getState().setIdToken(null);
}
