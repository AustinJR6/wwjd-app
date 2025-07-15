import { loadUserProfile, updateUserProfile } from '../../utils';
import type { UserProfile } from '../../types';
import { logProfileSync } from '@/lib/logProfileSync';

export async function ensureUserProfile(uid: string): Promise<UserProfile | null> {
  const profile = await loadUserProfile(uid);
  if (!profile) return null;
  const fixes: Partial<UserProfile> = {};
  if (!profile.religion) fixes.religion = 'SpiritGuide';
  if (profile.profileComplete === undefined) fixes.profileComplete = false;
  if (profile.profileSchemaVersion === undefined) fixes.profileSchemaVersion = 1 as any;
  if (Object.keys(fixes).length) {
    await updateUserProfile(fixes, uid);
    logProfileSync('ensure', fixes);
    return { ...profile, ...fixes } as UserProfile;
  }
  return profile as UserProfile;
}
