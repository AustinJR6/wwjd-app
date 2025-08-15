import {
  addDocument,
  querySubcollection,
  getDocumentByPath,
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
  const userDoc = await getDocumentByPath(`users/${storedUid}`);
  const usersIsSubscribed = userDoc?.isSubscribed;
  console.log(
    'SUBS ▶ REST users.isSubscribed',
    usersIsSubscribed,
    'fallback used?',
    usersIsSubscribed === undefined,
  );
  if (typeof usersIsSubscribed === 'boolean') return usersIsSubscribed;
  const subDoc = await getDocumentByPath(`subscriptions/${storedUid}`);
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
  const basePath = usePersistent
    ? `religionChats/${storedUid}`
    : `tempReligionChat/${storedUid}`;
  console.warn('🔥 Attempting Firestore access:', `${basePath}/messages`);
  console.warn('👤 Using UID:', storedUid);
  await addDocument(`${basePath}/messages`, {
    role,
    text,
    timestamp: new Date().toISOString(),
  });
}

export async function fetchHistory(
  uid: string,
  persistent?: boolean,
): Promise<ChatMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  const usePersistent =
    typeof persistent === 'boolean' ? persistent : await isSubscribed(storedUid);
  const basePath = usePersistent
    ? `religionChats/${storedUid}`
    : `tempReligionChat/${storedUid}`;
  console.warn('🔥 Attempting Firestore access:', `${basePath}/messages`);
  console.warn('👤 Using UID:', storedUid);
  return await querySubcollection(
    basePath,
    'messages',
    'timestamp',
    'ASCENDING',
  );
}

export async function clearHistory(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `religionChats/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await querySubcollection(`religionChats/${storedUid}`, 'messages');
  for (const msg of docs) {
    await deleteDocument(`religionChats/${storedUid}/messages/${msg.id}`);
  }
}

export async function clearTempReligionChat(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `tempReligionChat/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await querySubcollection(`tempReligionChat/${storedUid}`, 'messages');
  for (const msg of docs) {
    await deleteDocument(`tempReligionChat/${storedUid}/messages/${msg.id}`);
  }
}

export async function trimHistory(uid: string, limit: number): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `religionChats/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await querySubcollection(
    `religionChats/${storedUid}`,
    'messages',
    'timestamp',
    'ASCENDING',
  );
  if (docs.length <= limit) return;
  const excess = docs.length - limit;
  for (let i = 0; i < excess; i++) {
    await deleteDocument(`religionChats/${storedUid}/messages/${docs[i].id}`);
  }
}
