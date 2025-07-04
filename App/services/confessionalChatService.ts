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
  try {
    await addDocument(`confessionalChats/${storedUid}/messages`, {
      role,
      content,
      createdAt: new Date().toISOString(),
    });
    console.log('✅ Confessional message sent');
  } catch (error: any) {
    console.warn('💬 Confessional Error', error.response?.status, error.message);
    throw error;
  }
}

export async function fetchConfessionalHistory(uid: string): Promise<ConfessionalMessage[]> {
  const storedUid = await ensureAuth(uid);
  if (!storedUid) return [];
  console.warn('🔥 Attempting Firestore access:', `confessionalChats/${storedUid}/messages`);
  console.warn('👤 Using UID:', storedUid);
  try {
    return await querySubcollection(
      `confessionalChats/${storedUid}`,
      'messages',
      'createdAt',
      'ASCENDING',
    );
  } catch (error: any) {
    console.warn('💬 Confessional Error', error.response?.status, error.message);
    return [];
  }
}
