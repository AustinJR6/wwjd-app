// app/lib/firestoreRest.ts
import axios from 'axios';
import { decode as atob } from 'base-64';
import { getIdToken } from '@/utils/authUtils';

const FIREBASE_PROJECT_ID = 'wwjd-app';
const FIREBASE_WEB_API_KEY: string | undefined = undefined;

async function getAppCheckTokenOrNull(): Promise<string | null> {
  return null; // wire if you enforce App Check later
}

export async function getFirebaseIdToken(): Promise<string> {
  const token = await getIdToken(true);
  if (token) return token;
  const globalToken = (globalThis as any).__FIREBASE_ID_TOKEN__ as string | undefined;
  if (globalToken) return globalToken;
  throw new Error('Missing ID token. Wire getFirebaseIdToken() to your auth flow.');
}

function baseURLFor(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
}

function decodeJwt(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
    const normalized = b64 + '='.repeat(pad);
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function assertTokenMatchesProject(idToken: string) {
  const payload = decodeJwt(idToken);
  const iss: string | undefined = payload?.iss; // "https://securetoken.google.com/<project-id>"
  const projectFromIss = iss?.split('/').pop();
  if (!projectFromIss || projectFromIss !== FIREBASE_PROJECT_ID) {
    console.error('[FirestoreREST] \u{1F6AB} ID token project mismatch', {
      expectedProjectId: FIREBASE_PROJECT_ID,
      iss,
      aud: payload?.aud,
      sub: payload?.sub,
    });
    throw new Error(`ID token project mismatch (expected ${FIREBASE_PROJECT_ID}, got iss=${iss})`);
  }
}

function normalizeParent(parentPath: string) {
  return parentPath.replace(/^projects\/[^/]+\//, `projects/${FIREBASE_PROJECT_ID}/`);
}

const client = axios.create({
  baseURL: baseURLFor(FIREBASE_PROJECT_ID),
  timeout: 15000,
});

// No explicit Axios types here — works across Axios versions
client.interceptors.request.use(async (config) => {
  const idToken = await getFirebaseIdToken();
  assertTokenMatchesProject(idToken);

  if (!config.headers) config.headers = {};
  (config.headers as any)['Authorization'] = `Bearer ${idToken}`;
  (config.headers as any)['Content-Type'] = 'application/json';

  const appCheck = await getAppCheckTokenOrNull();
  if (appCheck) (config.headers as any)['X-Firebase-App-Check'] = appCheck;

  if (FIREBASE_WEB_API_KEY) {
    try {
      const u = new URL((config.baseURL ?? '') + (config.url ?? ''));
      if (!u.searchParams.get('key')) {
        u.searchParams.set('key', FIREBASE_WEB_API_KEY);
        config.url = u.pathname + '?' + u.searchParams.toString();
      }
    } catch {}
  }
  return config;
});

type StructuredQuery = Record<string, any>;

export async function runQueryREST(params: {
  parent: string; // e.g. "projects/wwjd-app/databases/(default)/documents/users/{uid}"
  structuredQuery: StructuredQuery;
}) {
  const parent = normalizeParent(params.parent);
  const body = { parent, structuredQuery: params.structuredQuery };

  try {
    const res = await client.post(`/documents:runQuery`, body);
    const data = res.data;
    return Array.isArray(data) ? data : [data];
  } catch (err: any) {
    console.error('\u{1F525} Firestore runQuery error', {
      status: err?.response?.status,
      data: err?.response?.data,
      url: err?.config?.baseURL + err?.config?.url,
      haveAuthHeader: !!err?.config?.headers?.Authorization,
      haveAppCheck: !!err?.config?.headers?.['X-Firebase-App-Check'],
      parent,
      projectId: FIREBASE_PROJECT_ID,
    });
    throw err;
  }
}

export function parentForUserDoc(uid: string) {
  return `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`;
}
export function parentFor(pathUnderDocuments: string) {
  return `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${pathUnderDocuments}`;
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
