import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { showPermissionDenied } from '@/utils/gracefulError';

function warnIfInvalidPath(path: string, expectEven: boolean) {
  const segments = path.split('/').filter(Boolean);
  if ((segments.length % 2 === 0) !== expectEven) {
    console.warn(`⚠️ Firestore path mismatch: ${path}`);
  }
}

function docRef(path: string) {
  const segments = path.split('/').filter(Boolean) as [string, ...string[]];
  return doc(db, ...segments);
}

function colRef(path: string) {
  const segments = path.split('/').filter(Boolean) as [string, ...string[]];
  return collection(db, ...segments);
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
    const snap = await getDoc(docRef(path));
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
    await setDoc(docRef(path), data, { merge: true });
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
    await updateDoc(docRef(path), data);
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
    const ref = await addDoc(colRef(collectionPath), data);
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
    await deleteDoc(docRef(path));
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
    const clauses: any[] = [];
    if (orderByField) {
      clauses.push(orderBy(orderByField, direction === 'DESCENDING' ? 'desc' : 'asc'));
    }
    if (filter) {
      clauses.push(where(filter.fieldPath, mapOp(filter.op) as any, filter.value));
    }
    if (clauses.length) {
      q = query(q, ...clauses);
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
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
    let q: any = colRef(`${parentPath}/${collectionName}`);
    if (orderByField) {
      q = query(q, orderBy(orderByField, direction === 'DESCENDING' ? 'desc' : 'asc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
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

