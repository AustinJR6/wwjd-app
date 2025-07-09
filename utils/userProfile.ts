import axios, { AxiosError } from 'axios';
import { FIRESTORE_BASE } from '../firebaseRest';
import { getAuthHeaders, getCurrentUserId } from '../App/utils/authUtils';
import { getDocument } from '../App/services/firestoreService';
import { logFirestoreError } from '../App/lib/logging';
import type { CachedProfile, ReligionDocument, UserProfile } from '../types/profile';
import { getReligionProfile } from '../religionRest';

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'number') fields[k] = { integerValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (Array.isArray(v))
      fields[k] = {
        arrayValue: {
          values: v.map((x) =>
            typeof x === 'object'
              ? { mapValue: { fields: toFirestoreFields(x) } }
              : { stringValue: String(x) }
          ),
        },
      };
    else if (typeof v === 'object') fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

let cachedProfile: CachedProfile | null = null;

export async function loadUserProfile(uid?: string): Promise<UserProfile | null> {
  const userId = uid ?? (await getCurrentUserId());
  if (!userId) {
    console.warn('loadUserProfile called with no uid');
    return null;
  }

  try {
    const user = await getDocument(`users/${userId}`);
    if (!user) {
      return null;
    }
    let religionData: ReligionDocument | null = null;
    if (user.religion) {
      religionData = await getReligionProfile(user.religion);
    }
    cachedProfile = { uid: userId, ...user, religionData } as CachedProfile;
    if (!user?.region || !user?.religion || !user?.username) {
      console.warn('⚠️ Missing required profile fields after onboarding:', user);
    }
    return cachedProfile;
  } catch (err: any) {
    const errorData = (err as AxiosError).response?.data;
    console.error('loadUserProfile failed', errorData || err);
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
  const sanitized: Record<string, any> = { ...fields };
  if (typeof sanitized.username === 'string') {
    sanitized.username = sanitized.username.trim();
  }
  if (typeof sanitized.displayName === 'string') {
    sanitized.displayName = sanitized.displayName.trim();
  }
  try {
    const headers = await getAuthHeaders();
    const url = `${FIRESTORE_BASE}/users/${userId}`;
    console.log('➡️ PATCH', url, { payload: sanitized, headers });
    await axios.patch(url, { fields: toFirestoreFields(sanitized) }, { headers });
    if (cachedProfile && cachedProfile.uid === userId) {
      if ('religion' in sanitized) {
        const religionData = await getReligionProfile(sanitized.religion);
        cachedProfile = {
          ...cachedProfile,
          ...sanitized,
          religionData: religionData || null,
        } as CachedProfile;
      } else {
        cachedProfile = { ...cachedProfile, ...sanitized } as CachedProfile;
      }
    }
    console.log('✅ Profile updated', sanitized);
  } catch (err: any) {
    const errorData = (err as AxiosError).response?.data;
    console.error('updateUserProfile failed', errorData || err);
  }
}

export async function incrementUserPoints(points: number, uid?: string): Promise<void> {
  const userId = uid ?? (await getCurrentUserId());
  if (!userId) {
    console.warn('incrementUserPoints called with no uid');
    return;
  }
  try {
    const headers = await getAuthHeaders();
    const url = `${FIRESTORE_BASE}/users/${userId}`;
    console.log('➡️ Sending Firestore request to:', url);
    const res = await axios.get(url, { headers });
    const current = Number(res.data?.fields?.individualPoints?.integerValue ?? 0);
    const newTotal = current + points;
    const body = { fields: toFirestoreFields({ individualPoints: newTotal }) };
    console.log('➡️ Sending Firestore request to:', url, body);
    await axios.patch(url, body, { headers });
    if (cachedProfile && cachedProfile.uid === userId) {
      cachedProfile = { ...cachedProfile, individualPoints: newTotal } as CachedProfile;
    }
    console.log('✅ Firestore response:', newTotal);
  } catch (error: any) {
    logFirestoreError('PATCH', `users/${userId}`, error);
    console.error('🔥 Firestore error:', error.message || error.response);
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
