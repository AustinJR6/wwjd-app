import { navigationRef } from '@/navigation/navigationRef';
import { setDocument, getDocument } from '@/services/firestoreService';
import { updateUserProfile } from '../../utils/firestoreHelpers';
import { ensureAuth } from '@/utils/authGuard';

export async function saveUsernameAndProceed(username: string): Promise<void> {
  const uid = await ensureAuth();
  await updateUserProfile(uid, { username });
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
  }
}

export async function checkIfUserIsNewAndRoute(): Promise<void> {
  const uid = await ensureAuth();
  const profile = await getDocument(`users/${uid}`);
  const completed = !!profile?.onboardingComplete;
  if (navigationRef.isReady()) {
    const initialRoute = completed ? 'Home' : 'Onboarding';
    console.log('🧭 initialRoute set', { initialRoute });
    navigationRef.reset({ index: 0, routes: [{ name: initialRoute }] });
  }
}
