import { loadUserProfile, updateUserProfile } from './userProfile';
import type { UserProfile } from '../../types';
import { logProfileSync } from '@/lib/logProfileSync';
import { DEFAULT_RELIGION } from '@/config/constants';

export async function ensureUserProfile(
  input: string | UserProfile,
): Promise<UserProfile | null> {
  const uid = typeof input === 'string' ? input : input.uid;
  let profile = typeof input === 'string' ? await loadUserProfile(input) : input;

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
    fixes.profileSchemaVersion = 1 as any;
  }

  const requiredFields: (keyof UserProfile)[] = [
    'preferredName',
    'pronouns',
    'avatarURL',
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

  let profileComplete = true;
  const patchedFields: Partial<UserProfile> = {};
  for (const field of requiredFields) {
    const value = (profile as any)[field];
    if (typeof value !== 'string' || value.trim() === '') {
      (profile as any)[field] = '';
      patchedFields[field] = '' as any;
      fixes[field] = '' as any;
      profileComplete = false;
    }
  }
  if ((profile as any).profileComplete !== profileComplete) {
    patchedFields.profileComplete = profileComplete as any;
    fixes.profileComplete = profileComplete as any;
  }

  // Always update lastActive on access
  fixes.lastActive = now;

  if (Object.keys(fixes).length) {
    await updateUserProfile(fixes, uid);
    console.log('[\uD83D\uDD27 ensureUserProfile] Patched missing fields:', patchedFields);
    logProfileSync('ensure', fixes);
    profile = { ...profile, ...fixes } as UserProfile;
  }

  return profile as UserProfile;
}
