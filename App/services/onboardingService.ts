import { navigationRef } from '@/navigation/navigationRef';
import { loadUserProfile, updateUserProfile } from '../../utils';
import { ensureAuth } from '@/utils/authGuard';

export async function saveUsernameAndProceed(username: string): Promise<void> {
  const uid = await ensureAuth();
  await updateUserProfile({ username }, uid);
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
  }
}

export async function checkIfUserIsNewAndRoute(): Promise<void> {
  const uid = await ensureAuth();
  const profile = await loadUserProfile(uid);
  const completed = !!profile?.onboardingComplete;
  if (navigationRef.isReady()) {
    const initialRoute = completed ? 'Home' : 'Onboarding';
    console.log('🧭 initialRoute set', { initialRoute });
    navigationRef.reset({ index: 0, routes: [{ name: initialRoute }] });
  }
}
