import { ENV } from '../../config/env';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${ENV.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function parseValue(value: any): any {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return new Date(value.timestampValue).toISOString();
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const vals = value.arrayValue?.values || [];
    return vals.map((v: any) => parseValue(v));
  }
  if ('mapValue' in value) {
    const obj: any = {};
    const fields = value.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = parseValue(v);
    }
    return obj;
  }
  return undefined;
}

export function mapFirestoreDocToPlain<T = any>(doc: any): { id: string } & T {
  const out: any = { id: doc.name?.split('/').pop() || '' };
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    const parsed = parseValue(v);
    if (parsed !== undefined) out[k] = parsed;
  }
  return out as { id: string } & T;
}

export async function getDocuments<T = any>(
  collectionPath: string,
  opts?: {
    pageSize?: number;
    orderBy?: string[];
    idToken?: string;
  }
): Promise<Array<{ id: string } & T>> {
  const { pageSize, orderBy = [], idToken } = opts || {};
  const url = new URL(`${BASE_URL}/${collectionPath}`);
  if (pageSize) url.searchParams.set('pageSize', String(pageSize));
  orderBy.forEach((o) => url.searchParams.append('orderBy', o));
  if (idToken) {
    // no API key when authenticated
  } else {
    url.searchParams.set('key', ENV.FIREBASE_WEB_API_KEY);
  }

  const res = await fetch(url.toString(), {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
  });
  if (!res.ok) {
    const error: any = new Error(`Request failed with status ${res.status}`);
    error.status = res.status;
    try {
      const body = await res.json();
      error.code = body.error?.status;
    } catch {}
    throw error;
  }
  const data = await res.json();
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return docs.map((d: any) => mapFirestoreDocToPlain<T>(d));
}

export type Religion = {
  id: string;
  name: string;
  prompt?: string;
  aiVoice?: string;
  defaultChallenges?: string[];
  language?: string;
  totalPoints?: number;
  userCount?: number;
  active?: boolean;
  order?: number;
};

export async function listReligions(params?: {
  includeInactive?: boolean;
  idToken?: string;
}): Promise<Religion[]> {
  const { includeInactive = false, idToken } = params || {};
  try {
    const docs = await getDocuments<Omit<Religion, 'id'>>('religion', {
      orderBy: ['order', 'name'],
      idToken,
    });
    const rows = docs
      .filter((r) => typeof r.name === 'string' && r.name.trim())
      .filter((r) => includeInactive || r.active !== false) as Religion[];
    if (__DEV__) console.debug('[religion] loaded', rows.length);
    return rows;
  } catch (err: any) {
    const status = err?.status;
    const code = err?.code;
    console.warn('[religion] fetch failed', { status, code });
    return [];
  }
}
