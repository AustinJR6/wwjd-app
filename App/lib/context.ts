import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import type { ChatMessage } from './db';

const db = getFirestore();

export async function loadActiveGoals(uid: string) {
  const q = query(
    collection(db, 'users', uid, 'goals'),
    where('status', '==', 'active'),
    fsLimit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function loadRelevantMemories(
  uid: string,
  limit = 15,
  tags?: string[],
) {
  let q = query(
    collection(db, 'users', uid, 'memories'),
    orderBy('lastUsedAt', 'desc'),
    orderBy('importance', 'desc'),
    orderBy('createdAt', 'desc'),
    fsLimit(limit),
  );
  if (tags && tags.length) {
    q = query(
      collection(db, 'users', uid, 'memories'),
      where('tags', 'array-contains-any', tags),
      orderBy('lastUsedAt', 'desc'),
      orderBy('importance', 'desc'),
      orderBy('createdAt', 'desc'),
      fsLimit(limit),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function loadRecentContext(
  uid: string,
  threadId: string,
  limit = 8,
): Promise<ChatMessage[]> {
  const q = query(
    collection(db, 'users', uid, 'chats', 'threads', threadId, 'messages'),
    orderBy('createdAt', 'desc'),
    fsLimit(limit),
  );
  const snap = await getDocs(q);
  const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ChatMessage[];
  return msgs
    .filter((m) => m.role !== 'system')
    .reverse();
}
