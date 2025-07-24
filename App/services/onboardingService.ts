import { navigationRef } from '@/navigation/navigationRef';
import { loadUserProfile, updateUserProfile } from '@/utils/userProfile';
import { ensureAuth } from '@/utils/authGuard';
import { Alert } from 'react-native';

export async function saveUsernameAndProceed(username: string): Promise<void> {
  const uid = await ensureAuth();
  await updateUserProfile({ username }, uid);
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  }
}

export async function checkIfUserIsNewAndRoute(): Promise<void> {
  const uid = await ensureAuth();
  if (!uid) return;
  const profile = await loadUserProfile(uid);
  const needsProfile =
    !profile?.onboardingComplete || !profile?.profileComplete;
  if (navigationRef.isReady()) {
    if (needsProfile) {
      Alert.alert('Profile Incomplete', 'Please complete your profile before using the app.');
      navigationRef.reset({ index: 0, routes: [{ name: 'ProfileCompletion' }] });
    } else {
      navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  }
}
