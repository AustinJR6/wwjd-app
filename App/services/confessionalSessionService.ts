import {
  addDocument,
  querySubcollection,
  deleteDocument,
} from '@/services/firestoreService';
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
  console.warn('🔥 Attempting Firestore access:', `tempConfessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  try {
    await addDocument(`tempConfessionalSessions/${storedUid}/messages`, {
      role,
      text,
      timestamp: new Date().toISOString(),
    });
    console.log('✅ Confessional message sent');
  } catch (error: any) {
    console.warn('💬 Confessional Error', error.response?.status, error.message);
    throw error;
  }
}

export async function fetchTempSession(uid: string): Promise<TempMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  console.warn('🔥 Attempting Firestore access:', `tempConfessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  try {
    return await querySubcollection(
      `tempConfessionalSessions/${storedUid}`,
      'messages',
      'timestamp',
      'ASCENDING',
    );
  } catch (error: any) {
    console.warn('💬 Confessional Error', error.response?.status, error.message);
    return [];
  }
}

export async function clearConfessionalSession(uid: string): Promise<void> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return;
  console.warn('🔥 Attempting Firestore access:', `tempConfessionalSessions/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  try {
    const docs = await querySubcollection(`tempConfessionalSessions/${storedUid}`, 'messages');
    for (const msg of docs) {
      await deleteDocument(`tempConfessionalSessions/${storedUid}/messages/${msg.id}`);
    }
  } catch (error: any) {
    console.warn('💬 Confessional Error', error.response?.status, error.message);
  }
}
