import apiClient from '@/utils/apiClient';
import { FIRESTORE_BASE } from '../../firebaseRest';
import { getAuthHeaders } from '@/utils/authUtils';
import type { UserProfileExtended } from '@/types/UserProfileExtended';

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v === null) {
      fields[k] = { nullValue: null };
    } else if (v instanceof Date) {
      fields[k] = { timestampValue: v.toISOString() };
    } else if (typeof v === 'number') {
      fields[k] = { integerValue: v.toString() };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((x) =>
            typeof x === 'object'
              ? { mapValue: { fields: toFirestoreFields(x) } }
              : { stringValue: String(x) },
          ),
        },
      };
    } else if (typeof v === 'object') {
      fields[k] = { mapValue: { fields: toFirestoreFields(v) } };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  }
  return fields;
}

function parseValue(v: any): any {
  if (v == null) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return fromFirestore({ fields: (v as any).mapValue.fields });
  if ('arrayValue' in v && Array.isArray((v as any).arrayValue.values)) {
    return (v as any).arrayValue.values.map((x: any) => parseValue(x));
  }
  return undefined;
}

function fromFirestore(doc: any): any {
  const out: any = {};
  if (!doc || !doc.fields) return out;
  for (const [k, v] of Object.entries(doc.fields)) {
    const parsed = parseValue(v);
    if (parsed !== undefined) out[k] = parsed;
  }
  return out;
}

const docPath = (uid: string) => `users/${uid}/profileExtended/main`;

export async function fetchExtendedProfile(uid: string): Promise<UserProfileExtended | null> {
  const url = `${FIRESTORE_BASE}/${docPath(uid)}`;
  try {
    const headers = await getAuthHeaders();
    const res = await apiClient.get(url, { headers });
    return fromFirestore(res.data) as UserProfileExtended;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) return null;
    console.warn('fetchExtendedProfile error', err?.response?.data || err?.message || err);
    return null;
  }
}

export async function saveExtendedProfile(uid: string, data: Partial<UserProfileExtended>) {
  const url = `${FIRESTORE_BASE}/${docPath(uid)}`;
  const headers = await getAuthHeaders();
  const withMeta = { ...data, updatedAt: new Date() };
  const body = { fields: toFirestoreFields(withMeta) };
  // PATCH will create the document if it doesn't exist
  await apiClient.patch(url, body, { headers });
}

