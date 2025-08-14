// functions/lib/firestoreRest.js
// Firestore REST helper (no Firebase SDK). JSDoc types for editor intellisense.

import { ENV } from '../../config/env';

const BASE_URL =
  `https://firestore.googleapis.com/v1/projects/${ENV.FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * @typedef {Object} Religion
 * @property {string} id
 * @property {string} name
 * @property {string=} prompt
 * @property {string=} aiVoice
 * @property {string[]=} defaultChallenges
 * @property {string=} language
 * @property {number=} totalPoints
 * @property {number=} userCount
 * @property {boolean=} active
 * @property {number=} order
 */

// ---------- Firestore value mapper ----------

function parseValue(value) {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return new Date(value.timestampValue).toISOString();
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    const vals = value.arrayValue?.values || [];
    return vals.map((v) => parseValue(v));
  }
  if ('mapValue' in value) {
    const out = {};
    const fields = value.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) out[k] = parseValue(v);
    return out;
  }
  return undefined;
}

/**
 * @template T
 * @param {any} doc
 * @returns {{ id: string } & T}
 */
export function mapFirestoreDocToPlain(doc) {
  const out = { id: doc.name?.split('/').pop() || '' };
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    const parsed = parseValue(v);
    if (parsed !== undefined) out[k] = parsed;
  }
  // @ts-ignore - JSDoc generic
  return out;
}

// ---------- Generic list ----------

/**
 * @template T
 * @param {string} collectionPath
 * @param {{ pageSize?: number, orderBy?: string[], idToken?: string }} [opts]
 * @returns {Promise<Array<{id: string} & T>>}
 */
export async function getDocuments(collectionPath, opts) {
  const { pageSize, orderBy = [], idToken } = opts || {};
  const url = new URL(`${BASE_URL}/${collectionPath}`);
  if (pageSize) url.searchParams.set('pageSize', String(pageSize));
  orderBy.forEach((o) => url.searchParams.append('orderBy', o));
  if (!idToken) url.searchParams.set('key', ENV.FIREBASE_WEB_API_KEY);

  const res = await fetch(url.toString(), {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
  });
  if (!res.ok) {
    const err = new Error(`Request failed with status ${res.status}`);
    // @ts-ignore add fields for debugging
    err.status = res.status;
    try {
      const body = await res.json();
      // @ts-ignore
      err.code = body.error?.status;
    } catch {}
    throw err;
  }
  const data = await res.json();
  const docs = Array.isArray(data.documents) ? data.documents : [];
  return docs.map((d) => mapFirestoreDocToPlain(d));
}

// ---------- Collection helpers ----------

/**
 * @param {{ includeInactive?: boolean, idToken?: string }} [params]
 * @returns {Promise<Religion[]>}
 */
export async function listReligions(params) {
  const { includeInactive = false, idToken } = params || {};
  try {
    const docs = await getDocuments('religion', {
      orderBy: ['order', 'name'],
      idToken,
    });
    /** @type {Religion[]} */
    const rows = docs
      .filter((r) => typeof r.name === 'string' && r.name.trim())
      .filter((r) => includeInactive || r.active !== false);
    if (__DEV__) console.debug('[religion] loaded', rows.length);
    return rows;
  } catch (err) {
    // @ts-ignore
    const status = err?.status;
    // @ts-ignore
    const code = err?.code;
    console.warn('[religion] fetch failed', { status, code });
    return [];
  }
}

/**
 * @param {string} id
 * @param {string=} idToken
 * @returns {Promise<Religion|null>}
 */
export async function getReligionById(id, idToken) {
  try {
    const url = idToken
      ? `${BASE_URL}/religion/${id}`
      : `${BASE_URL}/religion/${id}?key=${ENV.FIREBASE_WEB_API_KEY}`;
    const res = await fetch(url, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    });
    if (!res.ok) throw new Error(`Failed to fetch religion: ${res.status}`);
    const doc = await res.json();
    return mapFirestoreDocToPlain(doc);
  } catch (err) {
    console.warn('[religion] get by id failed', err);
    return null;
  }
}
