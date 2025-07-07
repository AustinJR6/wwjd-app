import axios from 'axios';
import { API_URL, getAuthHeaders } from '../App/config/firebaseApp';
import { getCurrentUserId } from '../App/utils/authUtils';
import type { CachedProfile, ReligionDocument, UserProfile } from '../types/profile';
import { getReligionProfile } from '../religionRest';

let cachedProfile: CachedProfile | null = null;

export async function loadUserProfile(uid?: string): Promise<UserProfile | null> {
  const userId = uid ?? (await getCurrentUserId());
  if (!userId) {
    console.warn('loadUserProfile called with no uid');
    return null;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${API_URL}/users/${userId}`, { headers });
    const user = res.data as UserProfile;
    let religionData: ReligionDocument | null = null;
    if (user.religion) {
      religionData = await getReligionProfile(user.religion);
    }
    cachedProfile = { uid: userId, ...user, religionData } as CachedProfile;
    return cachedProfile;
  } catch (err) {
    console.error('loadUserProfile failed', err);
    return null;
  }
}

export async function updateUserProfile(
  fields: Record<string, any>,
  uid?: string,
): Promise<void> {
  const userId = uid ?? (await getCurrentUserId());
  if (!userId) {
    console.warn('updateUserProfile called with no uid');
    return;
  }
  try {
    const headers = await getAuthHeaders();
    await axios.patch(`${API_URL}/users/${userId}`, fields, { headers });
    if (cachedProfile && cachedProfile.uid === userId) {
      if ('religion' in fields) {
        const religionData = await getReligionProfile(fields.religion);
        cachedProfile = {
          ...cachedProfile,
          ...fields,
          religionData: religionData || null,
        } as CachedProfile;
      } else {
        cachedProfile = { ...cachedProfile, ...fields } as CachedProfile;
      }
    }
    console.log('✅ Profile updated', fields);
  } catch (err) {
    console.error('updateUserProfile failed', err);
  }
}

export function getCachedUserProfile(): UserProfile | null {
  return cachedProfile;
}

export function setCachedUserProfile(profile: CachedProfile | null) {
  cachedProfile = profile;
}

export function getUserAIPrompt(): string {
  return (
    cachedProfile?.religionData?.prompt ||
    'Respond with empathy, logic, and gentle spirituality.'
  );
}
