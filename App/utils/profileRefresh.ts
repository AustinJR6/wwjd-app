import { loadFreshUserProfile } from './userProfile';
import { useUserProfileStore } from '@/state/userProfile';
import type { UserProfile } from '../../types';

export async function handlePostSubscription(uid: string): Promise<UserProfile | null> {
  console.log('🌱 Starting post-subscription refresh flow...');
  const updatedProfile = await loadFreshUserProfile(uid);
  if (updatedProfile) {
    useUserProfileStore.getState().setUserProfile(updatedProfile as any);
    console.log('✅ Updated user profile with post-subscription status');
  }
  return updatedProfile;
}
