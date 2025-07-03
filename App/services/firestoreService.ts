import axios from 'axios';
import { getIdToken, getCurrentUserId } from '@/utils/authUtils';
import { showPermissionDeniedForPath } from '@/utils/gracefulError';

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '';
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
    if (v === null) fields[k] = { nullValue: null };
    else if (typeof v === 'number') fields[k] = { integerValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map((x) => ({ stringValue: String(x) })) } };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

function fromFirestore(doc: any): any {
  const out: any = {};
  if (!doc || !doc.fields) return out;
  for (const [k, v] of Object.entries(doc.fields)) {
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('nullValue' in v) out[k] = null;
    else if ('arrayValue' in v && Array.isArray((v as any).arrayValue.values)) {
      out[k] = (v as any).arrayValue.values.map((x: any) => x.stringValue ?? null);
    }
  }
  return out;
}

async function authHeaders() {
  const token = await getIdToken(true);
  if (!token) {
    console.warn('🔐 authHeaders called with missing token');
    throw new Error('Missing auth token');
  }
  lastToken = token;
  console.log('📡 Using ID token', token.slice(0, 8));
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
    const res = await axios.get(`${BASE}/${path}`, { headers: await authHeaders() });
    return fromFirestore(res.data);
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
    if (err.response?.status === 403) {
      await logPermissionDetails(path);
      showPermissionDeniedForPath(path);
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
    await axios.patch(`${BASE}/${path}`, body, { headers: await authHeaders() });
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
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
    const res = await axios.post(`${BASE}/${collectionPath}`, body, { headers: await authHeaders() });
    const parts = res.data.name.split('/');
    return parts[parts.length - 1];
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${collectionPath}:`, err.response?.data || err.message);
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
    await axios.delete(`${BASE}/${path}`, { headers: await authHeaders() });
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
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
    const res = await axios.get(`${BASE}/${collectionPath}`, { headers: await authHeaders() });
    const docs = res.data.documents || [];
    return docs.map((d: any) => ({ id: d.name.split('/').pop(), ...fromFirestore(d) }));
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${collectionPath}:`, err.response?.data || err.message);
    if (err.response?.status === 403) {
      await logPermissionDetails(collectionPath);
      showPermissionDeniedForPath(collectionPath);
      return [];
    }
    return [];
  }
}

export async function querySubcollection(parentPath: string, collectionName: string): Promise<any[]> {
  console.log('➡️ Firestore SUBQUERY', `${parentPath}/${collectionName}`);
  return queryCollection(`${parentPath}/${collectionName}`);
}
