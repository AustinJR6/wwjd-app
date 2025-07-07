import axios from 'axios';
import { API_URL, getAuthHeaders } from '../App/config/firebaseApp';
import { getCurrentUserId } from '../App/utils/authUtils';

// 🚨 Centralized user update function. All profile field changes must go through here.
export async function updateUserProfile(
  uidOrFields: string | Record<string, any>,
  maybeFields?: Record<string, any>,
) {
  const uid =
    typeof uidOrFields === 'string'
      ? uidOrFields
      : await getCurrentUserId();
  const fields =
    typeof uidOrFields === 'string' ? maybeFields || {} : uidOrFields;

  if (!uid) {
    console.warn("\u274C No UID available for user update.");
    return;
  }

  try {
    const headers = await getAuthHeaders();
    console.log('➡️ PATCH /users', { uid, fields });
    await axios.patch(`${API_URL}/users/${uid}`, fields, { headers });
    console.log('✅ Profile updated:', fields);
  } catch (error) {
    console.error('🔥 Failed to update user profile:', error);
  }
}
