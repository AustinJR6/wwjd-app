import axios from 'axios';
import { FIRESTORE_BASE } from '../firebaseRest';
import { getAuthHeaders } from '../App/utils/authUtils';
import { getCurrentUserId } from '../App/utils/authUtils';

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
    const url = `${FIRESTORE_BASE}/users/${uid}`;
    console.log('➡️ PATCH', url, { payload: fields, headers });
    await axios.patch(url, { fields: toFirestoreFields(fields) }, { headers });
    console.log('✅ Profile updated:', fields);
  } catch (error: any) {
    const data = (error as any).response?.data;
    console.error('🔥 Failed to update user profile:', data || error);
  }
}
