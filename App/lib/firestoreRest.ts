// app/lib/firestoreRest.ts
// Client-side Firestore REST helper (no Firebase SDK). TypeScript + safe for Expo builds.

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!;
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_WEB_API_KEY!;

if (!PROJECT_ID || !API_KEY) {
  throw new Error(
    'Missing Firestore REST config. Ensure EXPO_PUBLIC_FIREBASE_PROJECT_ID and EXPO_PUBLIC_FIREBASE_WEB_API_KEY are set.'
  );
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ---------- Generic helpers ----------

async function handleResponse(res: Response) {
  if (!res.ok) {
    let msg = `Firestore REST error: ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error?.message || msg;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(msg);
  }
  return res.json();
}

// Note: Firestore REST "fields" use typed values. Convert to plain JS.
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
    for (const [k, v] of Object.entries(fields)) obj[k] = parseValue(v);
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

// ---------- Thin CRUD & query (client-safe) ----------

export async function getDocument(docPath: string) {
  const url = `${BASE_URL}/${docPath}?key=${API_KEY}`;
  const res = await fetch(url, { method: 'GET' });
  return handleResponse(res);
}

export async function createDocument(
  collectionPath: string,
  documentFields: Record<string, any>, // Firestore REST field map (typed values)
  docId?: string
) {
  const url = `${BASE_URL}/${collectionPath}${docId ? `?documentId=${encodeURIComponent(docId)}` : ''}&key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: documentFields }),
  });
  return handleResponse(res);
}

export async function updateDocument(docPath: string, documentFields: Record<string, any>) {
  const url = `${BASE_URL}/${docPath}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: documentFields }),
  });
  return handleResponse(res);
}

export async function deleteDocument(docPath: string) {
  const url = `${BASE_URL}/${docPath}?key=${API_KEY}`;
  const res = await fetch(url, { method: 'DELETE' });
  return handleResponse(res);
}

export async function queryCollection(collectionPath: string, structuredQuery: any) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionPath }],
        ...structuredQuery,
      },
    }),
  });
  return handleResponse(res);
}

// ---------- App-specific: Religion helpers ----------

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

/**
 * List all religions ordered by `order` then `name`.
 * Filters out inactive unless includeInactive = true.
 */
export async function listReligions(params?: { includeInactive?: boolean }): Promise<Religion[]> {
  const includeInactive = params?.includeInactive ?? false;

  // Using "documents:list" for simplicity & speed
  const url = `${BASE_URL}/religion?pageSize=200&orderBy=order&orderBy=name&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await handleResponse(res);

  const docs = Array.isArray(data.documents) ? data.documents : [];
  const rows = docs
    .map((d: any) => mapFirestoreDocToPlain<Religion>(d))
    .filter((r: { name: string; }) => typeof r.name === 'string' && r.name.trim())
    .filter((r: { active: boolean; }) => includeInactive || r.active !== false);

  if (__DEV__) console.debug('[religion] loaded', rows.length);
  return rows;
}

/**
 * Fetch a single religion document by ID for AI prompt building.
 */
export async function getReligionById(id: string): Promise<Religion | null> {
  try {
    const url = `${BASE_URL}/religion/${encodeURIComponent(id)}?key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch religion: ${res.status}`);
    const doc = await res.json();
    return mapFirestoreDocToPlain<Religion>(doc);
  } catch (err) {
    console.warn('[religion] get by id failed', err);
    return null;
  }
}
