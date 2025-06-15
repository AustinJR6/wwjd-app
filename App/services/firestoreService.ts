import axios from 'axios';
import { getStoredToken } from './authService';

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Firestore REST call without idToken');
    throw new Error('Missing auth token');
  }
  return { Authorization: `Bearer ${idToken}` };
}

export async function getDocument(path: string): Promise<any | null> {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE_URL}/${path}`, { headers });
  return res.data ? decodeData(res.data.fields) : null;
}

export async function setDocument(path: string, data: any): Promise<void> {
  const headers = await authHeaders();
  await axios.patch(
    `${BASE_URL}/${path}?updateMask.fieldPaths=*`,
    { fields: encodeData(data) },
    { headers }
  );
}

export async function addDocument(collectionPath: string, data: any): Promise<string> {
  const headers = await authHeaders();
  const res = await axios.post(
    `${BASE_URL}/${collectionPath}`,
    { fields: encodeData(data) },
    { headers }
  );
  const name: string = res.data.name;
  return name.split('/').pop() as string;
}

export async function queryCollection(
  collection: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING'
): Promise<any[]> {
  const headers = await authHeaders();
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
  };
  if (orderByField) {
    structuredQuery.orderBy = [
      { field: { fieldPath: orderByField }, direction },
    ];
  }
  const res = await axios.post(
    `${BASE_URL}:runQuery`,
    { structuredQuery },
    { headers }
  );
  const docs = (res.data as any[]).filter((d) => d.document).map((d) => ({
    id: d.document.name.split('/').pop(),
    ...decodeData(d.document.fields),
  }));
  return docs;
}
