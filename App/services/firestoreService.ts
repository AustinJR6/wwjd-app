// 🚫 Do not use @react-native-firebase. This app uses REST-only Firebase architecture.
import axios from 'axios';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';
import { FIRESTORE_BASE_URL, FIRESTORE_PARENT, getAuthHeader } from '@/config/firebaseApp';
import { checkAndRefreshIdToken, logTokenIssue } from '@/services/authService';
import { showPermissionDenied } from '@/utils/gracefulError';

function encodeValue(value: any): any {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: value }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((v) => encodeValue(v)) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeData(value) } };
  }
  return { stringValue: String(value) };
}

function encodeData(data: any): any {
  const fields: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
      throw new Error(`Invalid field name: ${k}`);
    }
    fields[k] = encodeValue(v);
  }
  return fields;
}

function decodeValue(value: any): any {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.mapValue) return decodeData(value.mapValue.fields || {});
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.nullValue !== undefined) return null;
  return value;
}

function decodeData(fields: any): any {
  const obj: any = {};
  for (const [k, v] of Object.entries(fields || {})) {
    obj[k] = decodeValue(v as any);
  }
  return obj;
}

async function authHeaders() {
  try {
    return await getAuthHeader();
  } catch {
    await logTokenIssue('firestore authHeaders', false);
    try {
      await checkAndRefreshIdToken();
      return await getAuthHeader();
    } catch {
      await logTokenIssue('firestore authHeaders', true);
      throw new Error('Missing auth token');
    }
  }
}

function warnIfInvalidPath(path: string, expectEven: boolean) {
  const segments = path.split('/').filter(Boolean);
  if ((segments.length % 2 === 0) !== expectEven) {
    console.warn(`⚠️ Firestore path mismatch: ${path}`);
  }
}

export async function getDocument(path: string): Promise<any | null> {
  warnIfInvalidPath(path, true);
  const headers = await authHeaders();
  try {
    const url = `${FIRESTORE_BASE_URL}/${path}`;
    const res = await sendRequestWithGusBugLogging(() => axios.get(url, { headers }));
    return res.data ? decodeData(res.data.fields) : null;
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
    if (err.response?.status === 404) return null;
    if (err.response?.status === 403) {
      showPermissionDenied();
      return null;
    }
    throw new Error(err.response?.data?.error?.message || 'Firestore error');
  }
}

export async function setDocument(path: string, data: any): Promise<void> {
  warnIfInvalidPath(path, true);
  const headers = await authHeaders();
  const fieldPaths = Object.keys(data)
    .filter((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
  const mask = fieldPaths
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const url = `${FIRESTORE_BASE_URL}/${path}${mask ? `?${mask}` : ''}`;
  try {
    await sendRequestWithGusBugLogging(() =>
      axios.patch(
        url,
        { fields: encodeData(data) },
        { headers }
      )
    );
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
    if (err.response?.status === 403) {
      showPermissionDenied();
      return;
    }
    throw err;
  }
}

export async function updateDocument(path: string, data: any): Promise<void> {
  // Alias of setDocument for semantic clarity
  await setDocument(path, data);
}

export async function addDocument(collectionPath: string, data: any): Promise<string> {
  warnIfInvalidPath(collectionPath, false);
  const headers = await authHeaders();
  try {
    const url = `${FIRESTORE_BASE_URL}/${collectionPath}`;
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post(
        url,
        { fields: encodeData(data) },
        { headers }
      )
    );
    const name: string = res.data.name;
    return name.split('/').pop() as string;
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${collectionPath}:`, err.response?.data || err.message);
    if (err.response?.status === 403) {
      showPermissionDenied();
      return '';
    }
    throw err;
  }
}

export async function deleteDocument(path: string): Promise<void> {
  warnIfInvalidPath(path, true);
  const headers = await authHeaders();
  const url = `${FIRESTORE_BASE_URL}/${path}`;
  try {
    await sendRequestWithGusBugLogging(() => axios.delete(url, { headers }));
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${path}:`, err.response?.data || err.message);
    if (err.response?.status === 404) return;
    if (err.response?.status === 403) {
      showPermissionDenied();
      return;
    }
    throw err;
  }
}

export async function queryCollection(
  collection: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING',
  filter?: { fieldPath: string; op: 'EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL'; value: any }
): Promise<any[]> {
  warnIfInvalidPath(collection, false);
  const headers = await authHeaders();
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
  };
  if (orderByField) {
    structuredQuery.orderBy = [
      { field: { fieldPath: orderByField }, direction },
    ];
  }
  if (filter) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: filter.fieldPath },
        op: filter.op,
        value: encodeValue(filter.value),
      },
    };
  }
  const url = `${FIRESTORE_BASE_URL}:runQuery`;
  try {
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post(
        url,
        { structuredQuery },
        { headers }
      )
    );
    const docs = (res.data as any[])
      .filter((d) => d.document)
      .map((d) => ({ id: d.document.name.split('/').pop(), ...decodeData(d.document.fields) }));
    return docs;
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${collection}:`, err.response?.data || err.message);
    if (err.response?.status === 404) return [];
    if (err.response?.status === 403) {
      showPermissionDenied();
      return [];
    }
    return [];
  }
}

export async function querySubcollection(
  parentPath: string,
  collection: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING'
): Promise<any[]> {
  warnIfInvalidPath(parentPath, true);
  warnIfInvalidPath(`${parentPath}/${collection}`, false);
  const headers = await authHeaders();
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
  };
  if (orderByField) {
    structuredQuery.orderBy = [
      { field: { fieldPath: orderByField }, direction },
    ];
  }
  const url = `${FIRESTORE_BASE_URL}:runQuery`;
  const body = {
    structuredQuery,
    parent: `${FIRESTORE_PARENT}/${parentPath}`,
  };
  try {
    const res = await sendRequestWithGusBugLogging(() =>
      axios.post(url, body, { headers })
    );
    const docs = (res.data as any[])
      .filter((d) => d.document)
      .map((d) => ({ id: d.document.name.split('/').pop(), ...decodeData(d.document.fields) }));
    return docs;
  } catch (err: any) {
    console.warn(`❌ Firestore REST error on ${parentPath}/${collection}:`, err.response?.data || err.message);
    if (err.response?.status === 404) return [];
    if (err.response?.status === 403) {
      showPermissionDenied();
      return [];
    }
    return [];
  }
}
