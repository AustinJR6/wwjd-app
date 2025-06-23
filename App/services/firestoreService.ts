import axios from 'axios';
import { getStoredToken } from './authService';
import { sendRequestWithGusBugLogging } from '@/utils/gusBugLogger';

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
  const idToken = await getStoredToken();
  if (!idToken) {
    console.warn('🚫 Firestore REST call without idToken');
    throw new Error('Missing auth token');
  }
  return { Authorization: `Bearer ${idToken}` };
}

export async function getDocument(path: string): Promise<any | null> {
  const headers = await authHeaders();
  try {
    const url = `${BASE_URL}/${path}`;
    const res = await sendRequestWithGusBugLogging(() => axios.get(url, { headers }));
    return res.data ? decodeData(res.data.fields) : null;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore getDocument error:', {
      url: `${BASE_URL}/${path}`,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw new Error(err.response?.data?.error?.message || 'Firestore error');
  }
}

export async function setDocument(path: string, data: any): Promise<void> {
  const headers = await authHeaders();
  const fieldPaths = Object.keys(data)
    .filter((k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k));
  const mask = fieldPaths
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const url = `${BASE_URL}/${path}${mask ? `?${mask}` : ''}`;
  try {
    await sendRequestWithGusBugLogging(() =>
      axios.patch(
        url,
        { fields: encodeData(data) },
        { headers }
      )
    );
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore setDocument error:', {
      url,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

export async function updateDocument(path: string, data: any): Promise<void> {
  // Alias of setDocument for semantic clarity
  await setDocument(path, data);
}

export async function addDocument(collectionPath: string, data: any): Promise<string> {
  const headers = await authHeaders();
  try {
    const url = `${BASE_URL}/${collectionPath}`;
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
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore addDocument error:', {
      url: `${BASE_URL}/${collectionPath}`,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

export async function deleteDocument(path: string): Promise<void> {
  const headers = await authHeaders();
  const url = `${BASE_URL}/${path}`;
  try {
    await sendRequestWithGusBugLogging(() => axios.delete(url, { headers }));
  } catch (err: any) {
    if (err.response?.status === 404) return;
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore deleteDocument error:', {
      url,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
}

export async function queryCollection(
  collection: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING',
  filter?: { fieldPath: string; op: 'EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL'; value: any }
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
  if (filter) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: filter.fieldPath },
        op: filter.op,
        value: encodeValue(filter.value),
      },
    };
  }
  const url = `${BASE_URL}:runQuery`;
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
    if (err.response?.status === 404) return [];
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore queryCollection error:', {
      url,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    return [];
  }
}

export async function querySubcollection(
  parentPath: string,
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
  const url = `${BASE_URL}/${parentPath}:runQuery`;
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
    if (err.response?.status === 404) return [];
    if (err.response?.status === 403) {
      console.error('❌ Firestore permission error:', err.response.data);
    }
    console.error('Firestore querySubcollection error:', {
      url,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    return [];
  }
}
