import { addDocument, querySubcollection } from './firestoreService';
import { deleteDocument } from './firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export async function saveMessage(
  uid: string,
  role: 'user' | 'assistant',
  text: string,
): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  await addDocument(`religionChats/${storedUid}/messages`, {
    role,
    text,
    timestamp: new Date().toISOString(),
  });
}

export async function fetchFullHistory(uid: string): Promise<ChatMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  return await querySubcollection(
    `religionChats/${storedUid}`,
    'messages',
    'timestamp',
    'ASCENDING',
  );
}

export async function clearHistory(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  const docs = await querySubcollection(`religionChats/${storedUid}`, 'messages');
  for (const msg of docs) {
    await deleteDocument(`religionChats/${storedUid}/messages/${msg.id}`);
  }
}

export async function trimHistory(uid: string, limit: number): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
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
