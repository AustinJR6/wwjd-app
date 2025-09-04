import axios from 'axios';
import { getIdToken } from '@/utils/authUtils';

const PROJECT_ID = 'wwjd-app';

export async function getFirebaseIdToken(): Promise<string> {
  // Prefer existing auth flow if available
  const token = await getIdToken(true);
  if (token) return token;
  const globalToken = (globalThis as any).__FIREBASE_ID_TOKEN__ as string | undefined;
  if (globalToken) return globalToken;
  throw new Error('Missing ID token. Wire getFirebaseIdToken() to your auth flow.');
}

export function firestoreDocumentsRunQueryUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
}

type StructuredQuery = Record<string, any>;

export async function runQueryREST(params: {
  parent: string; // e.g., "projects/wwjd-app/databases/(default)/documents/users/{uid}"
  structuredQuery: StructuredQuery;
}) {
  const url = firestoreDocumentsRunQueryUrl();
  const idToken = await getFirebaseIdToken();

  const res = await axios.post(url, params, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
  return Array.isArray(res.data) ? res.data : [res.data];
}

export function parseDocument(doc: any) {
  const out: Record<string, any> = { id: doc.name?.split('/').pop() };
  const f = doc.fields ?? {};
  for (const [k, v] of Object.entries<any>(f)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.arrayValue !== undefined) out[k] = (v.arrayValue.values ?? []).map(parseValue);
    else if (v.mapValue !== undefined) out[k] = parseMap(v.mapValue);
    else if (v.timestampValue !== undefined) out[k] = v.timestampValue;
    else out[k] = v;
  }
  return out;
}

function parseValue(v: any): any {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values ?? []).map(parseValue);
  if (v.mapValue !== undefined) return parseMap(v.mapValue);
  if (v.timestampValue !== undefined) return v.timestampValue;
  return v;
}

function parseMap(mapValue: any): any {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries<any>(mapValue.fields ?? {})) {
    out[k] = parseValue(v);
  }
  return out;
}

