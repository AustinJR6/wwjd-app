import { navigationRef } from '@/navigation/navigationRef';
import { setDocument, getDocument } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export async function saveUsernameAndProceed(username: string): Promise<void> {
  const uid = await ensureAuth();
  await setDocument(`users/${uid}`, { username });
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
  }
}

export async function checkIfUserIsNewAndRoute(): Promise<void> {
  const uid = await ensureAuth();
  const profile = await getDocument(`users/${uid}`);
  const hasUsername = !!profile?.username;
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: hasUsername ? 'Home' : 'Onboarding' }] });
  }
}
