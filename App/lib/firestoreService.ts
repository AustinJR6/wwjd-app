import { getIdToken } from '../lib/auth';

const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const PARENT = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${PARENT}`;

async function authedFetch(url: string, init: RequestInit = {}) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not signed in');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  headers.set('Content-Type', 'application/json');
  return fetch(url, { ...init, headers });
}

function toValue(v: any): any {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number')
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (v === null) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, toValue(val)])
        ),
      },
    };
  }
  return { stringValue: String(v) };
}

export async function runStructuredQuery(
  collection: string,
  opts?: {
    where?: { field: string; op: 'EQUAL'|'GREATER_THAN'|'LESS_THAN'|'ARRAY_CONTAINS'; value: any };
    limit?: number;
    orderBy?: { field: string; dir?: 'ASCENDING'|'DESCENDING' };
  }
) {
  const structuredQuery: any = {
    from: [{ collectionId: collection }],
  };

  if (opts?.limit) structuredQuery.limit = opts.limit;
  if (opts?.orderBy) {
    structuredQuery.orderBy = [{
      field: { fieldPath: opts.orderBy.field },
      direction: opts.orderBy.dir ?? 'ASCENDING',
    }];
  }
  if (opts?.where) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: opts.where.field },
        op: opts.where.op,
        value: toValue(opts.where.value),
      },
    };
  }

  const res = await authedFetch(`${BASE}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({
      parent: PARENT,
      structuredQuery,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Firestore QUERY failed on runQuery', res.status, text);
    throw new Error(text);
  }

  const rows = await res.json();
  return rows.filter((r: any) => r.document).map((r: any) => r.document);
}

export async function getDoc(path: string) {
  const res = await authedFetch(`https://firestore.googleapis.com/v1/${PARENT}/${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchDoc(path: string, fields: Record<string, any>) {
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, toValue(v)])
    ),
  };
  const res = await authedFetch(`https://firestore.googleapis.com/v1/${PARENT}/${path}?currentDocument.exists=true`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createDoc(collectionPath: string, fields: Record<string, any>, docId?: string) {
  const body = {
    fields: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, toValue(v)])
    ),
  };
  const url = docId
    ? `https://firestore.googleapis.com/v1/${PARENT}/${collectionPath}?documentId=${encodeURIComponent(docId)}`
    : `https://firestore.googleapis.com/v1/${PARENT}/${collectionPath}`;
  const res = await authedFetch(url, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export { authedFetch, toValue };

