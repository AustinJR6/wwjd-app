import { FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY } from '../../App/config/env';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } }
  | { nullValue: null };

function mapValue(v: FirestoreValue): any {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v)
    return (v.arrayValue.values || []).map((x) => mapValue(x as FirestoreValue));
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    const fields = v.mapValue.fields || {};
    for (const [k, val] of Object.entries(fields)) {
      out[k] = mapValue(val as FirestoreValue);
    }
    return out;
  }
  if ('nullValue' in v) return null;
  return undefined;
}

export function mapFirestoreDocToPlain<T = any>(doc: any): { id: string } & T {
  const name: string = doc?.name || '';
  const id = name.split('/').pop() || '';
  const fields: Record<string, FirestoreValue> = doc?.fields || {};
  const out: any = { id };
  for (const [k, v] of Object.entries(fields)) {
    const mapped = mapValue(v as FirestoreValue);
    if (mapped !== undefined) out[k] = mapped;
  }
  return out as { id: string } & T;
}

export async function getDocuments<T = any>(
  collectionPath: string,
  opts?: {
    pageSize?: number;
    orderBy?: string[];
    idToken?: string;
  },
): Promise<Array<{ id: string } & T>> {
  const { pageSize, orderBy = [], idToken } = opts || {};
  const url = new URL(`${BASE_URL}/${collectionPath}`);
  if (pageSize) url.searchParams.set('pageSize', String(pageSize));
  for (const o of orderBy) url.searchParams.append('orderBy', o);
  if (!idToken) url.searchParams.set('key', FIREBASE_WEB_API_KEY);

  const headers: Record<string, string> = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const err: any = new Error(`HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = await res.json();
  const docs: any[] = Array.isArray(data.documents) ? data.documents : [];
  return docs.map((d) => mapFirestoreDocToPlain<T>(d));
}

export type Religion = {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  order?: number;
};

export async function listReligions(params?: {
  includeInactive?: boolean;
  idToken?: string;
}): Promise<Religion[]> {
  const { includeInactive, idToken } = params || {};
  try {
    const docs = await getDocuments<Omit<Religion, 'id'>>('religion', {
      orderBy: ['order', 'name'],
      idToken,
    });
    const rows = docs
      .filter((r) => typeof r.name === 'string' && r.name.trim())
      .filter((r) => includeInactive || r.active !== false);
    return rows;
  } catch (err: any) {
    const status = err?.status;
    const code = err?.code || err?.response?.data?.error?.status;
    console.warn('[religion] fetch failed', { status, code });
    return [];
  }
}

