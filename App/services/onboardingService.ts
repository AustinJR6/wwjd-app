import { navigationRef } from '@/navigation/navigationRef';
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';
import { ensureAuth } from '@/utils/authGuard';

export async function saveUsernameAndProceed(username: string): Promise<void> {
  const uid = await ensureAuth();
  await updateUserProfile({ username }, uid);
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  }
}

export async function checkIfUserIsNewAndRoute(): Promise<void> {
  const uid = await ensureAuth();
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  }
}
