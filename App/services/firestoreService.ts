import apiClient from '@/utils/apiClient';
import axios from 'axios';
import { getIdToken, getCurrentUserId } from '@/utils/authUtils';
import { showPermissionDeniedForPath } from '@/utils/gracefulError';
import { logFirestoreError } from '@/lib/logging';
import Constants from 'expo-constants';

const PROJECT_ID = Constants.expoConfig?.extra?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
if (!PROJECT_ID) {
  console.warn('⚠️ Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env');
}
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let lastToken: string | null = null;

function warnIfInvalidPath(path: string, expectEven: boolean) {
  const segments = path.split('/').filter(Boolean);
  if ((segments.length % 2 === 0) !== expectEven) {
    console.warn(`⚠️ Firestore path mismatch: ${path}`);
  }
}

function toFirestoreFields(obj: any): any {
  const fields: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (v instanceof Date) {
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
              : { stringValue: String(x) }
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
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return fromFirestore({ fields: (v as any).mapValue.fields });
  if ("arrayValue" in v && Array.isArray((v as any).arrayValue.values)) {
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

async function authHeaders() {
  const token = await getIdToken(true);
  const uid = await getCurrentUserId();
  if (!token) {
    console.warn('🔐 authHeaders called with missing token');
    throw new Error('Missing auth token');
  }
  lastToken = token;
  console.log('📡 Using ID token', token.slice(0, 8), 'for UID', uid);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function logPermissionDetails(path: string) {
  const uid = await getCurrentUserId();
  const tokenPreview = lastToken ? lastToken.slice(0, 8) : 'none';
  const match = path.match(/^[^/]+\/([^/]+)/);
  const pathUid = match ? match[1] : 'unknown';
  if (!lastToken) {
    console.warn('❗ Permission denied due to missing token');
  }
  if (uid && pathUid && uid !== pathUid) {
    console.warn(`❗ UID mismatch. token UID: ${uid} path UID: ${pathUid}`);
  }
  console.warn(`🚫 Permission denied | uid: ${uid} | token: ${tokenPreview} | path: ${path}`);
}

export async function getDocument(path: string): Promise<any | null> {
  warnIfInvalidPath(path, true);
  try {
    console.log('➡️ Firestore GET', path);
    const res = await apiClient.get(`${BASE}/${path}`, { headers: await authHeaders() });
    return fromFirestore(res.data);
  } catch (err: any) {
    logFirestoreError('GET', path, err);
    const status = err.response?.status;
    if (status === 403) {
      await logPermissionDetails(path);
      showPermissionDeniedForPath(path);
      return null;
    }
    if (status === 404) {
      // Document missing is not an auth issue
      if (path.startsWith('subscriptions/')) {
        const defaultSub = {
          active: false,
          tier: 'free',
          subscribedAt: new Date(),
          createdVia: 'autoInit',
        };
        try {
          await setDocument(path, defaultSub);
        } catch (createErr) {
          console.error('Failed to auto-create subscription document', createErr);
        }
        return defaultSub;
      }
      return null;
    }
    throw err;
  }
}

export async function setDocument(
  path: string,
  data: any,
  options?: { requireExists?: boolean },
): Promise<void> {
  warnIfInvalidPath(path, true);
  try {
    const body = { fields: toFirestoreFields(data) };
    const maskParams = Object.keys(data)
      .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
      .join('&');
    let url = maskParams ? `${BASE}/${path}?${maskParams}` : `${BASE}/${path}`;
    if (options?.requireExists) {
      url += maskParams ? '&currentDocument.exists=true' : '?currentDocument.exists=true';
    }
    console.log('➡️ Firestore SET', path, data);
    await apiClient.patch(url, body, { headers: await authHeaders() });
  } catch (err: any) {
    logFirestoreError('SET', path, err);
    if (err.response?.status === 403) {
      await logPermissionDetails(path);
      showPermissionDeniedForPath(path);
      return;
    }
    throw err;
  }
}

export async function updateDocument(path: string, data: any): Promise<void> {
  await setDocument(path, data, { requireExists: true });
}

export async function addDocument(collectionPath: string, data: any): Promise<string> {
  warnIfInvalidPath(collectionPath, false);
  try {
    const body = { fields: toFirestoreFields(data) };
    console.log('➡️ Firestore ADD', collectionPath, data);
    const res = await apiClient.post(`${BASE}/${collectionPath}`, body, {
      headers: await authHeaders(),
    });
    const resData = res.data as { name: string };
    const parts = resData.name.split('/');
    return parts[parts.length - 1];
  } catch (err: any) {
    logFirestoreError('POST', collectionPath, err);
    if (err.response?.status === 403) {
      await logPermissionDetails(collectionPath);
      showPermissionDeniedForPath(collectionPath);
      return '';
    }
    throw err;
  }
}

export async function deleteDocument(path: string): Promise<void> {
  warnIfInvalidPath(path, true);
  try {
    console.log('➡️ Firestore DELETE', path);
    await apiClient.delete(`${BASE}/${path}`, { headers: await authHeaders() });
  } catch (err: any) {
    logFirestoreError('DELETE', path, err);
    if (err.response?.status === 403) {
      await logPermissionDetails(path);
      showPermissionDeniedForPath(path);
      return;
    }
    throw err;
  }
}

export async function queryCollection(
  collectionPath: string,
  options?: {
    orderByField?: string;
    direction?: 'ASCENDING' | 'DESCENDING';
    limit?: number;
    startAfter?: string;
  },
): Promise<any[]> {
  warnIfInvalidPath(collectionPath, false);
  const needsQuery = options && (options.orderByField || options.limit || options.startAfter);
  if (!needsQuery) {
    try {
      console.log('➡️ Firestore QUERY', collectionPath);
      const res = await apiClient.get(`${BASE}/${collectionPath}`, {
        headers: await authHeaders(),
      });
      const docs = (res.data as any).documents || [];
      return docs.map((d: any) => ({ id: d.name.split('/').pop(), ...fromFirestore(d) }));
    } catch (err: any) {
      logFirestoreError('GET', collectionPath, err);
      if (err.response?.status === 403) {
        await logPermissionDetails(collectionPath);
        showPermissionDeniedForPath(collectionPath);
        return [];
      }
      return [];
    }
  }

  const segments = collectionPath.split('/').filter(Boolean);
  const collectionId = segments.pop();
  const parentPath = segments.join('/');
  const structuredQuery: any = { from: [{ collectionId }] };
  if (options?.orderByField) {
    structuredQuery.orderBy = [
      {
        field: { fieldPath: options.orderByField },
        direction: options.direction || 'ASCENDING',
      },
    ];
  }
  if (options?.limit) structuredQuery.limit = options.limit;
  if (options?.startAfter) {
    structuredQuery.startAt = {
      values: [{ stringValue: options.startAfter }],
      before: false,
    };
  }
  const m = parentPath.match(/^users\/([^/]+)$/);
  if (m) {
    const uid = m[1];
    const rows = await runStructuredQuerySafe(
      { kind: 'userSub', uid, collectionId: collectionId! },
      structuredQuery,
    );
    return parseRunQueryRows(rows);
  }
  if (!parentPath) {
    const rows = await runStructuredQuerySafe(
      { kind: 'root', collectionId: collectionId! },
      structuredQuery,
    );
    return parseRunQueryRows(rows);
  }
  // For other parents (e.g., tempReligionChat/{uid}), treat as a document subcollection
  const rows = await runStructuredQuerySafe(
    { kind: 'docSub', docPath: parentPath, collectionId: collectionId! },
    structuredQuery,
  );
  return parseRunQueryRows(rows);
}

const PARENT = `projects/${PROJECT_ID}/databases/(default)/documents`;

export async function runStructuredQuery(
  structuredQuery: any,
  parentPath = '',
): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body: any = { structuredQuery };
  body.parent = parentPath ? `${PARENT}/${parentPath}` : PARENT;
  try {
    console.log('➡️ Firestore RUNQUERY', JSON.stringify(body));
    const res = await apiClient.post(url, body, {
      headers: await authHeaders(),
    });
    const docs = Array.isArray(res.data) ? (res.data as any[]) : [];
    return docs
      .filter((d: any) => d.document)
      .map((d: any) => ({ id: d.document.name.split('/').pop(), ...fromFirestore(d.document) }));
  } catch (err: any) {
    logFirestoreError('QUERY', 'runQuery', err);
    if (err.response?.status === 403) {
      await logPermissionDetails('runQuery');
      showPermissionDeniedForPath('runQuery');
      return [];
    }
    return [];
  }
}

// =========================
// Safer runQuery wrappers
// =========================

export type RootSpec = { kind: 'root'; collectionId: string };
export type UserSubSpec = { kind: 'userSub'; uid: string; collectionId: string };
export type DocSubSpec = { kind: 'docSub'; docPath: string; collectionId: string };
export type PathSpec = RootSpec | UserSubSpec | DocSubSpec;

const RUNQUERY_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

function buildParentAndFrom(spec: PathSpec): { parent: string; from: any[]; debugTarget: string } {
  if (spec.kind === 'root') {
    return {
      parent: `projects/${PROJECT_ID}/databases/(default)/documents`,
      from: [{ collectionId: spec.collectionId }],
      debugTarget: `/${spec.collectionId} (root)`,
    };
  }
  if (spec.kind === 'userSub') {
    return {
      parent: `projects/${PROJECT_ID}/databases/(default)/documents/users/${spec.uid}`,
      from: [{ collectionId: spec.collectionId }],
      debugTarget: `/users/${spec.uid}/${spec.collectionId} (sub)`,
    };
  }
  if (spec.kind === 'docSub') {
    return {
      parent: `projects/${PROJECT_ID}/databases/(default)/documents/${spec.docPath}`,
      from: [{ collectionId: spec.collectionId }],
      debugTarget: `/${spec.docPath}/${spec.collectionId} (docSub)`,
    };
  }
  const _exhaustive: never = spec;
  throw new Error('Unsupported PathSpec');
}

export async function runStructuredQuerySafe(spec: PathSpec, structuredQuery: Omit<any, 'from'>) {
  const { parent, from, debugTarget } = buildParentAndFrom(spec);
  const body = { parent, structuredQuery: { from, ...structuredQuery } };
  try {
    const res = await axios.post(RUNQUERY_URL, body, { headers: await authHeaders(), timeout: 15000 });
    return Array.isArray(res.data) ? res.data : [res.data];
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.error?.message || err?.message || String(err);
    console.error(
      `🔥 Firestore QUERY failed on runQuery`,
      JSON.stringify({ status, message: msg, target: debugTarget, body }, null, 2),
    );
    if (status === 403) {
      if ((spec as any).kind === 'userSub') {
        const c = (spec as UserSubSpec).collectionId;
        console.warn(
          `[Rules hint] To allow reads on ${debugTarget}, add an owner rule like:\n` +
            `match /databases/{db}/documents {\n` +
            `  function isOwner(uid) { return request.auth != null && request.auth.uid == uid; }\n` +
            `  match /users/{userId}/${c}/{docId} {\n` +
            `    allow read: if isOwner(userId);\n` +
            `  }\n` +
            `}`,
        );
      } else if ((spec as any).kind === 'docSub') {
        const ds = spec as DocSubSpec;
        console.warn(
          `[Rules hint] To allow reads on ${debugTarget}, add a rule like:\n` +
            `match /databases/{db}/documents {\n` +
            `  match /${ds.docPath}/${ds.collectionId}/{docId} {\n` +
            `    allow read: if request.auth != null && request.auth.uid == docPath().segments(1);\n` +
            `    // Or replace docPath check with your own owner/subscriber logic\n` +
            `  }\n` +
            `}`,
        );
      } else {
        const c = (spec as RootSpec).collectionId;
        console.warn(
          `[Rules hint] To allow reads on ${debugTarget}, add a root rule like:\n` +
            `match /databases/{db}/documents {\n` +
            `  match /${c}/{docId} {\n` +
            `    allow read: if request.auth != null;\n` +
            `  }\n` +
            `}`,
        );
      }
    }
    throw err;
  }
}

export async function queryUserSub(
  uid: string,
  collectionId: string,
  opts: { orderBy?: { fieldPath: string; direction?: 'ASCENDING' | 'DESCENDING' }[]; limit?: number; where?: any } = {},
) {
  const spec: UserSubSpec = { kind: 'userSub', uid, collectionId };
  const q: any = {};
  if (opts.where) {
    // Support simple where shape { fieldPath, op, value }
    if (opts.where.fieldPath || opts.where.field) {
      const fp = opts.where.fieldPath || opts.where.field;
      const op = opts.where.op || 'EQUAL';
      q.where = { fieldFilter: { field: { fieldPath: fp }, op, value: toFirestoreValue(opts.where.value) } };
    } else {
      q.where = opts.where;
    }
  }
  if (opts.orderBy) {
    q.orderBy = opts.orderBy.map((o: any) => (o.field ? o : { field: { fieldPath: o.fieldPath || o.field }, direction: o.direction || 'ASCENDING' }));
  }
  if (opts.limit) q.limit = opts.limit;
  return runStructuredQuerySafe(spec, q);
}

export async function queryRoot(
  collectionId: string,
  opts: { orderBy?: { fieldPath: string; direction?: 'ASCENDING' | 'DESCENDING' }[]; limit?: number; where?: any } = {},
) {
  const spec: RootSpec = { kind: 'root', collectionId };
  const q: any = {};
  if (opts.where) {
    if (opts.where.fieldPath || opts.where.field) {
      const fp = opts.where.fieldPath || opts.where.field;
      const op = opts.where.op || 'EQUAL';
      q.where = { fieldFilter: { field: { fieldPath: fp }, op, value: toFirestoreValue(opts.where.value) } };
    } else {
      q.where = opts.where;
    }
  }
  if (opts.orderBy) {
    q.orderBy = opts.orderBy.map((o: any) => (o.field ? o : { field: { fieldPath: o.fieldPath || o.field }, direction: o.direction || 'ASCENDING' }));
  }
  if (opts.limit) q.limit = opts.limit;
  return runStructuredQuerySafe(spec, q);
}

export function parseRunQueryRows(rows: any[]): any[] {
  return rows
    .map((r: any) => r.document)
    .filter(Boolean)
    .map((doc: any) => {
      const id = doc.name?.split('/').pop();
      const fields = doc.fields ?? {};
      const out: any = { id };
      for (const [k, v] of Object.entries<any>(fields)) {
        if (v.stringValue !== undefined) out[k] = v.stringValue;
        else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
        else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
        else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
        else if (v.arrayValue !== undefined) out[k] = (v.arrayValue.values ?? []).map(valToJs);
        else if (v.mapValue !== undefined) out[k] = mapToJs(v.mapValue);
        else if (v.timestampValue !== undefined) out[k] = v.timestampValue;
      }
      return out;
    });
}
function valToJs(v: any): any {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(valToJs);
  if (v.mapValue !== undefined) return mapToJs(v.mapValue);
  if (v.timestampValue !== undefined) return v.timestampValue;
  return v;
}
function mapToJs(mv: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries<any>(mv.fields ?? {})) out[k] = valToJs(v);
  return out;
}

// Convert primitive JS values to Firestore value objects for WHERE
function toFirestoreValue(v: any): any {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)])) } };
  return { stringValue: String(v) };
}

export async function fetchTopUsersByPoints(limit = 10): Promise<any[]> {
  const query = {
    from: [{ collectionId: 'users' }],
    orderBy: [{ field: { fieldPath: 'individualPoints' }, direction: 'DESCENDING' }],
    limit,
  };
  console.warn('📄 Structured query path:', 'users');
  console.warn('🔍 Structured query filters:', {
    orderBy: query.orderBy,
    limit,
  });
  const rows = await runStructuredQuerySafe({ kind: 'root', collectionId: 'users' }, { orderBy: [{ field: { fieldPath: 'individualPoints' }, direction: 'DESCENDING' }], limit });
  return parseRunQueryRows(rows);
}

export async function fetchTopReligions(limit = 10): Promise<any[]> {
  const rows = await runStructuredQuerySafe(
    { kind: 'root', collectionId: 'religion' },
    { orderBy: [{ field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' }], limit },
  );
  return parseRunQueryRows(rows);
}

export async function fetchTopOrganizations(limit = 10): Promise<any[]> {
  const rows = await runStructuredQuerySafe(
    { kind: 'root', collectionId: 'organizations' },
    { orderBy: [{ field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' }], limit },
  );
  return parseRunQueryRows(rows);
}

export async function runSubcollectionQuery(
  parentPath: string,
  collectionName: string,
  options?: {
    orderByField?: string;
    direction?: 'ASCENDING' | 'DESCENDING';
    limit?: number;
    startAfter?: string;
  },
): Promise<any[]> {
  const collectionPath = `${parentPath}/${collectionName}`;
  console.warn('📄 Structured subquery path:', collectionPath);
  const structuredQuery: any = { from: [{ collectionId: collectionName }] };
  if (options?.orderByField) {
    structuredQuery.orderBy = [
      {
        field: { fieldPath: options.orderByField },
        direction: options.direction || 'ASCENDING',
      },
    ];
  }
  if (options?.limit) structuredQuery.limit = options.limit;
  if (options?.startAfter) {
    structuredQuery.startAt = {
      values: [{ stringValue: options.startAfter }],
      before: false,
    };
  }
  console.warn('🔍 Structured query filters:', {
    orderBy: structuredQuery.orderBy,
    limit: options?.limit,
  });
  const m = parentPath.match(/^users\/([^/]+)$/);
  if (m) {
    const uid = m[1];
    const rows = await runStructuredQuerySafe(
      { kind: 'userSub', uid, collectionId: collectionName },
      structuredQuery,
    );
    return parseRunQueryRows(rows);
  }
  if (!parentPath) {
    const rows = await runStructuredQuerySafe(
      { kind: 'root', collectionId: collectionName },
      structuredQuery,
    );
    return parseRunQueryRows(rows);
  }
  // Treat any other parent (e.g., tempReligionChat/{uid}) as a document subcollection
  const rows = await runStructuredQuerySafe(
    { kind: 'docSub', docPath: parentPath, collectionId: collectionName },
    structuredQuery,
  );
  return parseRunQueryRows(rows);
}

// Backwards compatibility
export { runSubcollectionQuery as querySubcollection };

// -------------------
// Active Challenge
// -------------------

/**
 * Fetch the active challenge document for a user, creating it if missing.
 * This prevents 404 errors when the document hasn't been initialized yet.
 */
export async function getOrCreateActiveChallenge(
  uid: string,
): Promise<any> {
  const path = `users/${uid}/activeChallenge/current`;
  let doc = await getDocument(path);
  if (!doc) {
    doc = {
      challengeText: '',
      totalDays: 1,
      currentDay: 1,
      startDate: new Date().toISOString(),
      lastCompleted: null,
      completedDays: [],
      isComplete: true,
      isMultiDay: false,
      basePoints: 1,
      doubleBonusEligible: false,
    };
    await setDocument(path, doc);
  }
  return doc;
}

export async function updateActiveChallenge(
  uid: string,
  data: any,
): Promise<void> {
  const path = `users/${uid}/activeChallenge/current`;
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return;
  await setDocument(path, clean, { requireExists: true });
}
















