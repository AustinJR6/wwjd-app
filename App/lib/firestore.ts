import firestore from '@react-native-firebase/firestore';
import { showPermissionDenied } from '@/utils/gracefulError';

const db = firestore();

function warnIfInvalidPath(path: string, expectEven: boolean) {
  const segments = path.split('/').filter(Boolean);
  if ((segments.length % 2 === 0) !== expectEven) {
    console.warn(`⚠️ Firestore path mismatch: ${path}`);
  }
}

function docRef(path: string) {
  return db.doc(path);
}

function colRef(path: string) {
  return db.collection(path);
}

function mapOp(op: string) {
  switch (op) {
    case 'EQUAL':
      return '==';
    case 'LESS_THAN':
      return '<';
    case 'LESS_THAN_OR_EQUAL':
      return '<=';
    case 'GREATER_THAN':
      return '>';
    case 'GREATER_THAN_OR_EQUAL':
      return '>=';
    default:
      return '==';
  }
}

export async function getDocument(path: string): Promise<any | null> {
  warnIfInvalidPath(path, true);
  console.warn('🔥 Attempting Firestore access:', path);
  try {
    const snap = await docRef(path).get();
    return snap.exists() ? snap.data() : null;
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${path}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return null;
    }
    throw err;
  }
}

export async function setDocument(path: string, data: any): Promise<void> {
  warnIfInvalidPath(path, true);
  console.warn('🔥 Attempting Firestore access:', path);
  try {
    await docRef(path).set(data, { merge: true });
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${path}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return;
    }
    throw err;
  }
}

export async function updateDocument(path: string, data: any): Promise<void> {
  warnIfInvalidPath(path, true);
  console.warn('🔥 Attempting Firestore access:', path);
  try {
    await docRef(path).update(data);
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${path}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return;
    }
    throw err;
  }
}

export async function addDocument(collectionPath: string, data: any): Promise<string> {
  warnIfInvalidPath(collectionPath, false);
  console.warn('🔥 Attempting Firestore access:', collectionPath);
  try {
    const ref = await colRef(collectionPath).add(data);
    return ref.id;
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${collectionPath}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return '';
    }
    throw err;
  }
}

export async function deleteDocument(path: string): Promise<void> {
  warnIfInvalidPath(path, true);
  console.warn('🔥 Attempting Firestore access:', path);
  try {
    await docRef(path).delete();
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${path}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return;
    }
    throw err;
  }
}

export async function queryCollection(
  collectionPath: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING',
  filter?: { fieldPath: string; op: 'EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL'; value: any },
): Promise<any[]> {
  warnIfInvalidPath(collectionPath, false);
  console.warn('🔥 Attempting Firestore access:', collectionPath);
  try {
    let q: any = colRef(collectionPath);
    if (orderByField) {
      q = q.orderBy(orderByField, direction === 'DESCENDING' ? 'desc' : 'asc');
    }
    if (filter) {
      q = q.where(filter.fieldPath, mapOp(filter.op) as any, filter.value);
    }
    const snap = await q.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${collectionPath}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return [];
    }
    return [];
  }
}

export async function querySubcollection(
  parentPath: string,
  collectionName: string,
  orderByField?: string,
  direction: 'DESCENDING' | 'ASCENDING' = 'DESCENDING',
): Promise<any[]> {
  warnIfInvalidPath(parentPath, true);
  warnIfInvalidPath(`${parentPath}/${collectionName}`, false);
  console.warn('🔥 Attempting Firestore access:', `${parentPath}/${collectionName}`);
  try {
    let q: any = docRef(parentPath).collection(collectionName);
    if (orderByField) {
      q = q.orderBy(orderByField, direction === 'DESCENDING' ? 'desc' : 'asc');
    }
    const snap = await q.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
  } catch (err: any) {
    console.warn(`❌ Firestore error on ${parentPath}/${collectionName}:`, err.message || err);
    if (err.code === 'permission-denied') {
      console.warn('Firestore 403 – not a session issue', err);
      showPermissionDenied();
      return [];
    }
    return [];
  }
}
