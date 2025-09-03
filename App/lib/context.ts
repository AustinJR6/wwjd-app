import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

const db = getFirestore();

export async function loadActiveGoals(uid: string, max = 10) {
  const q = query(collection(db, 'users', uid, 'goals'), where('status', 'in', ['active', 'Active']), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
}

export async function loadRelevantMemories(uid: string, max = 15) {
  const q = query(
    collection(db, 'users', uid, 'memories'),
    orderBy('lastUsedAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
}

export async function loadRecentContext(uid: string, threadId: string, max = 8) {
  const q = query(
    collection(db, 'users', uid, 'chats', 'threads', threadId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(max)
  );
  const snap = await getDocs(q);
  // return newest->oldest reversed to oldest->newest
  return snap.docs.map(d => d.data()).reverse() as any[];
}

