import { loadUserProfile, updateUserProfile } from '@/utils';
import type { UserProfile } from '../../types';
import { logProfileSync } from '@/lib/logProfileSync';
import { callFunction } from '@/services/functionService';
import { useUserProfileStore } from '@/state/userProfile';
import { DEFAULT_RELIGION } from '@/config/constants';

export async function ensureUserProfile(uid: string): Promise<UserProfile | null> {
  let profile = await loadUserProfile(uid);

  // If the profile doesn't exist, create one via cloud function
  if (!profile) {
    try {
      profile = await callFunction('createUserProfile', { uid });
      logProfileSync('created', profile);
    } catch (err) {
      console.warn('ensureUserProfile create failed', err);
      return null;
    }
  }

  if (!profile) return null;

  const now = new Date().toISOString();
  const fixes: Partial<UserProfile> = {};

  const ensureString = (key: keyof UserProfile, defaultVal: string) => {
    const val = (profile as any)[key];
    if (typeof val !== 'string') fixes[key] = defaultVal as any;
  };
  const ensureNumber = (key: keyof UserProfile, defaultVal: number) => {
    const val = (profile as any)[key];
    if (typeof val !== 'number') fixes[key] = defaultVal as any;
  };
  const ensureBoolean = (key: keyof UserProfile, defaultVal: boolean) => {
    const val = (profile as any)[key];
    if (typeof val !== 'boolean') fixes[key] = defaultVal as any;
  };
  const ensureTimestamp = (key: keyof UserProfile, defaultVal: string) => {
    const val = (profile as any)[key];
    if (typeof val !== 'string') fixes[key] = defaultVal as any;
  };
  const ensureNullableString = (
    key: keyof UserProfile,
    defaultVal: string | null,
  ) => {
    const val = (profile as any)[key];
    if (val === undefined || val === null || typeof val !== 'string') {
      fixes[key] = defaultVal as any;
    }
  };

  ensureString('email', '');
  ensureBoolean('emailVerified', false);
  ensureString('displayName', 'New User');
  ensureTimestamp('createdAt', now);
  ensureTimestamp('lastFreeAsk', now);
  ensureTimestamp('lastFreeSkip', now);
  ensureBoolean('onboardingComplete', false);
  ensureString('religion', DEFAULT_RELIGION);
  ensureNullableString('organization', null);
  ensureNumber('tokens', 0);
  ensureNumber('skipTokensUsed', 0);
  ensureNumber('individualPoints', 0);
  ensureBoolean('isSubscribed', false);
  ensureBoolean('nightModeEnabled', false);
  ensureString('preferredName', '');
  ensureString('pronouns', '');
  ensureString('avatarURL', '');
  ensureTimestamp('lastActive', now);
  if ((profile as any).profileSchemaVersion === undefined) {
    fixes.profileSchemaVersion = 'v1' as any;
  }

  const requiredFields: (keyof UserProfile)[] = [
    'email',
    'emailVerified',
    'displayName',
    'createdAt',
    'lastFreeAsk',
    'lastFreeSkip',
    'onboardingComplete',
    'religion',
    'organization',
    'tokens',
    'skipTokensUsed',
    'individualPoints',
    'isSubscribed',
    'nightModeEnabled',
  ];

  let complete = true;
  for (const k of requiredFields) {
    const val = fixes[k] ?? (profile as any)[k];
    if (val === undefined || val === null || val === '') {
      complete = false;
      break;
    }
  }
  if ((profile as any).profileComplete !== complete) {
    fixes.profileComplete = complete;
  }

  // Always update lastActive on access
  fixes.lastActive = now;

  if (Object.keys(fixes).length) {
    await updateUserProfile(fixes, uid);
    logProfileSync('ensure', fixes);
    profile = { ...profile, ...fixes } as UserProfile;
  }

  // Update Zustand store
  useUserProfileStore.getState().setUserProfile(profile as UserProfile);

  return profile as UserProfile;
}
