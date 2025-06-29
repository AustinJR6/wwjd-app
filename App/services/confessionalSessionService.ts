import { addDocument, querySubcollection, deleteDocument } from './firestoreService';
import { ensureAuth } from '@/utils/authGuard';

export interface TempMessage {
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export async function saveTempMessage(
  uid: string,
  role: 'user' | 'assistant',
  text: string,
): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `confessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  await addDocument(`confessionalSessions/${storedUid}/messages`, {
    role,
    text,
    timestamp: new Date().toISOString(),
  });
}

export async function fetchTempSession(uid: string): Promise<TempMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  console.warn('🔥 Attempting Firestore access:', `confessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  return await querySubcollection(
    `confessionalSessions/${storedUid}`,
    'messages',
    'timestamp',
    'ASCENDING',
  );
}

export async function clearConfessionalSession(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `confessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  const docs = await querySubcollection(`confessionalSessions/${storedUid}`, 'messages');
  for (const msg of docs) {
    await deleteDocument(`confessionalSessions/${storedUid}/messages/${msg.id}`);
  }
}
