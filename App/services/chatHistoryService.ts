import {
  addDocument,
  runSubcollectionQuery,
  getDocument,
  deleteDocument,
} from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export async function isSubscribed(uid: string): Promise<boolean> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return false;
  const userDoc = await getDocument(`users/${storedUid}`);
  const usersIsSubscribed = userDoc?.isSubscribed;
  console.log(
    'SUBS ▶ REST users.isSubscribed',
    usersIsSubscribed,
    'fallback used?',
    usersIsSubscribed === undefined,
  );
  if (typeof usersIsSubscribed === 'boolean') return usersIsSubscribed;
  const subDoc = await getDocument(`subscriptions/${storedUid}`);
  const status = subDoc?.status;
  return status === 'active' || status === 'trialing';
}

// Alias used by various screens
export async function checkIfUserIsSubscribed(uid: string): Promise<boolean> {
  return isSubscribed(uid);
}

export async function saveMessage(
  uid: string,
  role: 'user' | 'assistant',
  text: string,
  persistent?: boolean,
): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  const usePersistent =
    typeof persistent === 'boolean' ? persistent : await isSubscribed(storedUid);
  const payload = { role, content: text, timestamp: Date.now() };
  if (usePersistent) {
    console.warn('🔥 Attempting Firestore access:', `users/${storedUid}/religionChats`);
    console.warn('👤 Using UID:', storedUid);
    await addDocument(`users/${storedUid}/religionChats`, payload);
    try {
      await addDocument(`religionChats/${storedUid}/messages`, payload);
    } catch {}
  } else {
    console.warn('👤 Using UID:', storedUid);
    await addDocument(`tempReligionChat/${storedUid}/messages`, payload);
  }
}

export async function fetchHistory(
  uid: string,
  persistent?: boolean,
): Promise<ChatMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  const usePersistent =
    typeof persistent === 'boolean' ? persistent : await isSubscribed(storedUid);
  if (usePersistent) {
    console.warn('🔥 Attempting Firestore access:', `users/${storedUid}/religionChats`);
    console.warn('👤 Using UID:', storedUid);
    const docs = await runSubcollectionQuery(
      `users/${storedUid}`,
      'religionChats',
      { orderByField: 'timestamp' },
    );
    return docs.map((d: any) => ({
      id: d.id,
      role: d.role,
      text: d.text ?? d.content,
      timestamp: d.timestamp,
    }));
  } else {
    console.warn('👤 Using UID:', storedUid);
    const docs = await runSubcollectionQuery(
      `tempReligionChat/${storedUid}`,
      'messages',
      { orderByField: 'timestamp' },
    );
    return docs.map((d: any) => ({
      id: d.id,
      role: d.role,
      text: d.text ?? d.content,
      timestamp: d.timestamp,
    }));
  }
}

export async function clearHistory(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `users/${storedUid}/religionChats`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await runSubcollectionQuery(
    `users/${storedUid}`,
    'religionChats',
  );
  for (const msg of docs) {
    await deleteDocument(`users/${storedUid}/religionChats/${msg.id}`);
  }
}

export async function clearTempReligionChat(uid: string): Promise<void> {
  return;
}


export async function trimHistory(uid: string, limit: number): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `users/${storedUid}/religionChats`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await runSubcollectionQuery(
    `users/${storedUid}`,
    'religionChats',
    { orderByField: 'timestamp' },
  );
  if (docs.length <= limit) return;
  const excess = docs.length - limit;
  for (let i = 0; i < excess; i++) {
    await deleteDocument(`users/${storedUid}/religionChats/${docs[i].id}`);
  }
}


