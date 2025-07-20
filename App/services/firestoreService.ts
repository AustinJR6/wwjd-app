import apiClient from '@/utils/apiClient';
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
      return null;
    }
    throw err;
  }
}

export async function setDocument(path: string, data: any): Promise<void> {
  warnIfInvalidPath(path, true);
  try {
    const body = { fields: toFirestoreFields(data) };
    console.log('➡️ Firestore SET', path, data);
    await apiClient.patch(`${BASE}/${path}`, body, { headers: await authHeaders() });
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
  await setDocument(path, data);
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

export async function queryCollection(collectionPath: string): Promise<any[]> {
  warnIfInvalidPath(collectionPath, false);
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

export async function runStructuredQuery(query: any): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  try {
    console.log('➡️ Firestore RUNQUERY', JSON.stringify(query));
    const res = await apiClient.post(url, { structuredQuery: query }, {
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
  return runStructuredQuery(query);
}

export async function fetchTopReligions(limit = 10): Promise<any[]> {
  const query = {
    from: [{ collectionId: 'religion' }],
    orderBy: [{ field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' }],
    limit,
  };
  console.warn('📄 Structured query path:', 'religion');
  console.warn('🔍 Structured query filters:', {
    orderBy: query.orderBy,
    limit,
  });
  return runStructuredQuery(query);
}

export async function fetchTopOrganizations(limit = 10): Promise<any[]> {
  const query = {
    from: [{ collectionId: 'organizations' }],
    orderBy: [{ field: { fieldPath: 'totalPoints' }, direction: 'DESCENDING' }],
    limit,
  };
  console.warn('📄 Structured query path:', 'organizations');
  console.warn('🔍 Structured query filters:', {
    orderBy: query.orderBy,
    limit,
  });
  return runStructuredQuery(query);
}

export async function querySubcollection(
  parentPath: string,
  collectionName: string,
  orderByField?: string,
  direction: 'ASCENDING' | 'DESCENDING' = 'ASCENDING',
): Promise<any[]> {
  const fullPath = `${parentPath}/${collectionName}`;
  console.warn('📄 Structured subquery path:', fullPath);
  if (!orderByField) {
    return queryCollection(fullPath);
  }
  const query = {
    parent: `projects/${PROJECT_ID}/databases/(default)/documents/${fullPath}`,
    from: [{ collectionId: collectionName }],
    orderBy: [{ field: { fieldPath: orderByField }, direction }],
  };
  console.warn('🔍 Structured query filters:', {
    orderBy: query.orderBy,
  });
  return runStructuredQuery(query);
}

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
      day: 1,
      completed: false,
      startTimestamp: new Date().toISOString(),
    };
    await setDocument(path, doc);
  }
  return doc;
}
