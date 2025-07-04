import { addDocument, querySubcollection } from '@/services/firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export interface ConfessionalMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export async function saveConfessionalMessage(
  uid: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `confessionalChats/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  await addDocument(`confessionalChats/${storedUid}/messages`, {
    role,
    content,
    createdAt: new Date().toISOString(),
  });
}

export async function fetchConfessionalHistory(uid: string): Promise<ConfessionalMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  console.warn('🔥 Attempting Firestore access:', `confessionalChats/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  return await querySubcollection(
    `confessionalChats/${storedUid}`,
    'messages',
    'createdAt',
    'ASCENDING',
  );
}
