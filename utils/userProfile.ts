import axios from 'axios';
import { API_URL, getAuthHeaders } from '../App/config/firebaseApp';
import { getCurrentUserId } from '../App/utils/authUtils';
import { getDocument } from '../App/services/firestoreService';

export interface ReligionData {
  id: string;
  name?: string;
  aiVoice?: string;
  prompt?: string;
  defaultChallenges?: any[];
  totalPoints?: number;
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  username?: string;
  region?: string;
  religion: string;
  points?: number;
  streak?: number;
  currentChallenge?: any;
  onboardingComplete?: boolean;
  religionData?: ReligionData | null;
  [key: string]: any;
}

let cachedProfile: UserProfile | null = null;

export async function loadUserProfile(uid?: string): Promise<UserProfile | null> {
  const userId = uid ?? (await getCurrentUserId());
  if (!userId) {
    console.warn('loadUserProfile called with no uid');
    return null;
  }

  try {
    const user = await getDocument(`users/${userId}`);
    if (!user) return null;
    let religionData: ReligionData | null = null;
    if (user.religion) {
      religionData = await getDocument(`religions/${user.religion}`);
      if (religionData && !('prompt' in religionData)) {
        console.log(`⚠️ Religion ${user.religion} missing 'prompt' field`);
      }
    }
    cachedProfile = { uid: userId, ...user, religionData } as UserProfile;
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
      cachedProfile = { ...cachedProfile, ...fields };
    }
    console.log('✅ Profile updated', fields);
  } catch (err) {
    console.error('updateUserProfile failed', err);
  }
}

export function getCachedUserProfile(): UserProfile | null {
  return cachedProfile;
}

export function getUserAIPrompt(): string {
  return cachedProfile?.religionData?.prompt || '';
}
